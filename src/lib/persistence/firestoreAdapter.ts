import { db, auth } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_ENTITIES } from '../entitySystem';
import { toScopedMemory } from '../memorySystem';
import {
  decodeCompanionDocId,
  ensureValidDocId,
  handleFirestoreError,
  logFirestoreError,
  normalizeMessageSchema,
  OperationType,
  removeUndefined,
} from '../persistenceSystem';
import { Gift, Message } from '../types';
import {
  CloudPersistenceAdapter,
  CloudRemoteSnapshot,
  DurableCompanion,
  DurableConversationMeta,
  DurableGift,
  DurableMessage,
  MutationRecord,
  ScopedMemory,
} from './types';

const PREVIEW_MESSAGE_LIMIT = 15;
const MAX_TOMBSTONES_PER_CONVERSATION = 100;

export function buildSanitizedPreviewMessage(m: Message, convId: string, idx = 0): Message {
  const normalized = normalizeMessageSchema(m, convId, idx);
  const { parts, generatedImages, ...mRest } = normalized;
  const cleanParts = (parts || []).map((p: any) => {
    const { inlineData, thoughtSignature, ...pRest } = p || {};
    if (inlineData) {
      return { ...pRest, text: pRest.text || '[Image attachment]' };
    }
    return pRest;
  });
  const cleanGeneratedImages = Array.isArray(generatedImages)
    ? generatedImages.filter(
        (img) => img && typeof img.imageUrl === 'string' && !img.imageUrl.startsWith('data:')
      )
    : undefined;
  return {
    ...mRest,
    parts: cleanParts,
    ...(cleanGeneratedImages && cleanGeneratedImages.length > 0
      ? { generatedImages: cleanGeneratedImages }
      : {}),
  };
}

export function deriveConsistentPreviewMessages(
  messages: DurableMessage[],
  convId: string,
  deletedMessageIds: Set<string>
): Message[] {
  const active = (messages || [])
    .filter((m) => m && !m.isDeleted && !deletedMessageIds.has(m.id))
    .sort((a, b) => {
      const diff = (a.timestamp || 0) - (b.timestamp || 0);
      if (diff !== 0) return diff;
      if (a.role === 'user' && b.role === 'model') return -1;
      if (a.role === 'model' && b.role === 'user') return 1;
      return (a.id || '').localeCompare(b.id || '');
    });

  return active
    .slice(-PREVIEW_MESSAGE_LIMIT)
    .map((m, idx) => buildSanitizedPreviewMessage(m, convId, idx));
}

/**
 * Authoritative Firestore Cloud Adapter with:
 * - Atomic batch updates keeping conversation previews + tombstones strictly synchronized with message subcollections
 * - Dedicated shared memory (`users/{uid}/memories`) and private companion memory (`users/{uid}/companions/{id}/memories`) collections
 * - Clean subscription lifecycle management
 */
export class FirestorePersistenceAdapter implements CloudPersistenceAdapter {
  public subscribeUser(
    uid: string,
    email: string | null | undefined,
    onRemoteUpdate: (update: CloudRemoteSnapshot) => void,
    onError: (err: Error) => void
  ): () => void {
    if (!uid) return () => {};

    let active = true;
    const unsubs: Unsubscribe[] = [];
    const messageUnsubs = new Map<string, Unsubscribe>();
    const companionMemUnsubs = new Map<string, Unsubscribe>();

    const attachCompanionMemoryListener = (rawCompanionId: string) => {
      const canonicalId = rawCompanionId.replace(/^models\//, '').trim();
      if (!canonicalId || companionMemUnsubs.has(canonicalId)) return;
      const safeCompDocId = ensureValidDocId(canonicalId, 'companion');
      const memColRef = collection(db, 'users', uid, 'companions', safeCompDocId, 'memories');

      const unsub = onSnapshot(
        memColRef,
        (snap) => {
          if (!active) return;
          const memories: ScopedMemory[] = [];
          snap.forEach((mDoc) => {
            const raw = mDoc.data() as any;
            if (raw?.isDeleted) return;
            const scoped = toScopedMemory(
              {
                ...raw,
                id: mDoc.id,
                author: 'model',
                modelId: canonicalId,
              },
              raw?.revision || raw?.updatedAt || raw?.createdAt || 0
            );
            memories.push({
              ...scoped,
              scope: 'companion',
              entityId: canonicalId,
              modelId: canonicalId,
            });
          });
          onRemoteUpdate({
            companionMemories: {
              companionId: canonicalId,
              memories,
            },
          });
        },
        (err) => {
          logFirestoreError(
            err,
            OperationType.LIST,
            `users/${uid}/companions/${safeCompDocId}/memories`
          );
          onError(err);
        }
      );

      companionMemUnsubs.set(canonicalId, unsub);
    };

    // Subscribe to all default companions' private memory subcollections immediately
    for (const defaultEntityId of Object.keys(DEFAULT_ENTITIES)) {
      attachCompanionMemoryListener(defaultEntityId);
    }

    // 1. Settings & Jewel & Profile (`users/{uid}/settings/app`)
    const settingsRef = doc(db, 'users', uid, 'settings', 'app');
    unsubs.push(
      onSnapshot(
        settingsRef,
        (snap) => {
          if (!active) return;
          if (snap.exists()) {
            const data = snap.data();
            onRemoteUpdate({
              settings: data.settings,
              settingsRevision: data.settingsRevision || data.updatedAt || 0,
              jewelMetrics: data.jewelMetrics,
              jewelRevision: data.jewelRevision || data.updatedAt || 0,
              userProfile: data.userProfile
                ? { ...data.userProfile, id: data.userProfile.id || uid }
                : undefined,
              profileRevision: data.profileRevision || data.updatedAt || 0,
              memoriesMigratedV2: Boolean(data.memoriesMigratedV2),
            });
          } else {
            onRemoteUpdate({
              memoriesMigratedV2: false,
            });
          }
        },
        (err) => {
          logFirestoreError(err, OperationType.GET, `users/${uid}/settings/app`);
          onError(err);
        }
      )
    );

    // 2. Shared Sanctuary Memories (`users/{uid}/memories`)
    const sharedMemoriesRef = collection(db, 'users', uid, 'memories');
    unsubs.push(
      onSnapshot(
        sharedMemoriesRef,
        (snap) => {
          if (!active) return;
          const sharedMemories: ScopedMemory[] = [];
          snap.forEach((mDoc) => {
            const raw = mDoc.data() as any;
            if (raw?.isDeleted) return;
            const scoped = toScopedMemory(
              {
                ...raw,
                id: mDoc.id,
              },
              raw?.revision || raw?.updatedAt || raw?.createdAt || 0
            );
            sharedMemories.push({
              ...scoped,
              scope: raw?.scope === 'legacy' ? 'legacy' : 'shared',
            });
          });
          onRemoteUpdate({ sharedMemories });
        },
        (err) => {
          logFirestoreError(err, OperationType.LIST, `users/${uid}/memories`);
          onError(err);
        }
      )
    );

    // 3. Conversations & Dynamic Message Subcollections (`users/{uid}/conversations`)
    const convsRef = collection(db, 'users', uid, 'conversations');
    unsubs.push(
      onSnapshot(
        convsRef,
        (snap) => {
          if (!active) return;
          const activeConvIds = new Set<string>();
          const conversations: { meta: DurableConversationMeta; previewMessages: Message[] }[] = [];

          snap.forEach((cDoc) => {
            const convId = cDoc.id;
            const data = cDoc.data();
            if (data?.isDeleted) return;

            activeConvIds.add(convId);
            const updatedAt = data.updatedAt || data.createdAt || 0;
            const createdAt = data.createdAt || updatedAt;
            const deletedMessageIds: string[] = Array.isArray(data.deletedMessageIds)
              ? data.deletedMessageIds
              : [];
            const deletedSet = new Set(deletedMessageIds);

            const previewMessages = Array.isArray(data.messages)
              ? data.messages
                  .map((m: any, idx: number) =>
                    normalizeMessageSchema(m, convId, idx, updatedAt || Date.now())
                  )
                  .filter((m: Message) => !deletedSet.has(m.id))
              : [];

            conversations.push({
              meta: {
                id: convId,
                title: data.title || 'Untitled Sanctuary',
                modelId: data.modelId || 'models/gemini-3.1-pro-preview',
                createdAt,
                updatedAt,
                revision: data.revision || updatedAt || 0,
                type: data.type || 'direct',
                participantEntityIds: data.participantEntityIds,
                deletedMessageIds,
              },
              previewMessages,
            });

            if (!messageUnsubs.has(convId)) {
              const msgsRef = collection(db, 'users', uid, 'conversations', convId, 'messages');
              const unsubMsgs = onSnapshot(
                msgsRef,
                (msgsSnap) => {
                  if (!active) return;
                  const messages: DurableMessage[] = [];
                  let idx = 0;
                  msgsSnap.forEach((mDoc) => {
                    const mData = mDoc.data() as any;
                    if (mData?.isDeleted) return;
                    const normalized = normalizeMessageSchema(
                      { ...mData, id: mDoc.id },
                      convId,
                      idx++
                    );
                    messages.push({
                      ...normalized,
                      conversationId: convId,
                      revision: mData?.revision || normalized.timestamp || 0,
                    });
                  });
                  onRemoteUpdate({
                    conversationMessages: {
                      conversationId: convId,
                      messages,
                    },
                  });
                },
                (err) => {
                  logFirestoreError(
                    err,
                    OperationType.LIST,
                    `users/${uid}/conversations/${convId}/messages`
                  );
                  onError(err);
                }
              );
              messageUnsubs.set(convId, unsubMsgs);
            }
          });

          for (const [convId, unsub] of messageUnsubs.entries()) {
            if (!activeConvIds.has(convId)) {
              unsub();
              messageUnsubs.delete(convId);
            }
          }

          onRemoteUpdate({ conversations });
        },
        (err) => {
          logFirestoreError(err, OperationType.LIST, `users/${uid}/conversations`);
          onError(err);
        }
      )
    );

    // 4. Gifts (`users/{uid}/gifts`)
    const giftsRef = collection(db, 'users', uid, 'gifts');
    unsubs.push(
      onSnapshot(
        giftsRef,
        (snap) => {
          if (!active) return;
          const gifts: DurableGift[] = [];
          snap.forEach((gDoc) => {
            const gData = gDoc.data() as any;
            if (gData?.isDeleted) return;
            gifts.push({
              ...(gData as Gift),
              id: gDoc.id,
              timestamp: gData.timestamp || 0,
              revision: gData.revision || gData.timestamp || 0,
            });
          });
          onRemoteUpdate({ gifts });
        },
        (err) => {
          logFirestoreError(err, OperationType.LIST, `users/${uid}/gifts`);
          onError(err);
        }
      )
    );

    // 5. Companions (`users/{uid}/companions`) + dynamic companion memory listeners
    const companionsRef = collection(db, 'users', uid, 'companions');
    unsubs.push(
      onSnapshot(
        companionsRef,
        (snap) => {
          if (!active) return;
          const companions: Record<string, DurableCompanion> = {};
          snap.forEach((cDoc) => {
            const data = cDoc.data() as any;
            const canonicalId = decodeCompanionDocId(cDoc.id, data?.id);
            companions[canonicalId] = {
              ...data,
              id: canonicalId,
              updatedAt: data?.updatedAt || 0,
              revision: data?.revision || data?.updatedAt || 0,
            };
            attachCompanionMemoryListener(canonicalId);
          });
          onRemoteUpdate({ companions });
        },
        (err) => {
          logFirestoreError(err, OperationType.LIST, `users/${uid}/companions`);
          onError(err);
        }
      )
    );

    // 6. One-time Legacy Monolithic Document Recovery (`users/{uid}` and `users/{email}`)
    void (async () => {
      try {
        const userDocSnap = await getDoc(doc(db, 'users', uid));
        let legacyData: any = userDocSnap.exists() ? { ...userDocSnap.data() } : null;

        const targetEmail = email || auth.currentUser?.email;
        if (targetEmail && targetEmail !== uid) {
          try {
            const emailSnap = await getDoc(doc(db, 'users', targetEmail));
            if (emailSnap.exists()) {
              const eData = emailSnap.data();
              if (!legacyData) {
                legacyData = { ...eData };
              } else if (Array.isArray(eData.conversations) && eData.conversations.length > 0) {
                const existingIds = new Set(
                  (legacyData.conversations || []).map((c: any) => c?.id)
                );
                const extra = eData.conversations.filter(
                  (c: any) => c && c.id && !existingIds.has(c.id)
                );
                legacyData.conversations = [...(legacyData.conversations || []), ...extra];
              }
            }
          } catch {
            // Ignore read rejection or missing doc on email key
          }
        }

        if (active && legacyData) {
          onRemoteUpdate({ legacyMonolithicData: legacyData });
        }
      } catch (err) {
        logFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    })();

    return () => {
      active = false;
      unsubs.forEach((u) => u());
      messageUnsubs.forEach((u) => u());
      messageUnsubs.clear();
      companionMemUnsubs.forEach((u) => u());
      companionMemUnsubs.clear();
    };
  }

  public async executeMutation(
    uid: string,
    mutation: MutationRecord,
    context: {
      conversationMeta?: DurableConversationMeta;
      conversationMessages?: DurableMessage[];
    }
  ): Promise<void> {
    if (!uid) throw new Error('Authenticated UID required for cloud mutation');

    const { entityType, operation, payload, revision } = mutation;
    const opType = operation === 'delete' ? OperationType.DELETE : OperationType.WRITE;
    const targetPath = resolveMutationPath(uid, mutation);

    try {
      switch (entityType) {
        case 'settings': {
          const settingsRef = doc(db, 'users', uid, 'settings', 'app');
          await setDoc(
            settingsRef,
            removeUndefined({
              id: 'app',
              userId: uid,
              settings: payload.settings,
              settingsRevision: revision,
              ...(payload.memoriesMigratedV2 !== undefined
                ? { memoriesMigratedV2: payload.memoriesMigratedV2 }
                : {}),
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }

        case 'jewel': {
          const settingsRef = doc(db, 'users', uid, 'settings', 'app');
          await setDoc(
            settingsRef,
            removeUndefined({
              id: 'app',
              userId: uid,
              jewelMetrics: payload.jewelMetrics,
              jewelRevision: revision,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }

        case 'profile': {
          const settingsRef = doc(db, 'users', uid, 'settings', 'app');
          const rootRef = doc(db, 'users', uid);
          const profilePayload = payload.userProfile
            ? { ...payload.userProfile, id: payload.userProfile.id || uid }
            : null;
          const batch = writeBatch(db);
          batch.set(
            settingsRef,
            removeUndefined({
              id: 'app',
              userId: uid,
              userProfile: profilePayload,
              profileRevision: revision,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          batch.set(
            rootRef,
            removeUndefined({
              id: uid,
              userProfile: profilePayload,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          await batch.commit();
          return;
        }

        case 'conversation': {
          const safeConvId = ensureValidDocId(mutation.entityId, 'conv');
          const convRef = doc(db, 'users', uid, 'conversations', safeConvId);

          if (operation === 'delete') {
            const msgsColRef = collection(
              db,
              'users',
              uid,
              'conversations',
              safeConvId,
              'messages'
            );
            const msgSnap = await getDocs(msgsColRef);
            if (!msgSnap.empty) {
              let batch = writeBatch(db);
              let count = 0;
              for (const mDoc of msgSnap.docs) {
                batch.delete(mDoc.ref);
                count++;
                if (count >= 400) {
                  await batch.commit();
                  batch = writeBatch(db);
                  count = 0;
                }
              }
              if (count > 0) {
                await batch.commit();
              }
            }
            await deleteDoc(convRef);
            return;
          }

          const convMeta = (payload as DurableConversationMeta) || context.conversationMeta;
          if (!convMeta) return;
          const deletedIds = (convMeta.deletedMessageIds || []).slice(
            -MAX_TOMBSTONES_PER_CONVERSATION
          );
          const deletedSet = new Set(deletedIds);
          const allMsgs = context.conversationMessages || [];
          const previewMessages = deriveConsistentPreviewMessages(allMsgs, safeConvId, deletedSet);

          const { isDeleted: _ignored, previewMessages: _pIgnored, ...cleanMeta } = convMeta;
          await setDoc(
            convRef,
            removeUndefined({
              ...cleanMeta,
              id: safeConvId,
              title: convMeta.title || 'Untitled Sanctuary',
              modelId: convMeta.modelId || 'models/gemini-3.1-pro-preview',
              createdAt: convMeta.createdAt || convMeta.updatedAt || mutation.clientTimestamp,
              updatedAt: convMeta.updatedAt || mutation.clientTimestamp,
              revision,
              deletedMessageIds: deletedIds,
              messages: previewMessages,
            }),
            { merge: true }
          );
          return;
        }

        case 'message': {
          const safeConvId = ensureValidDocId(mutation.parentId || payload?.conversationId, 'conv');
          const safeMsgId = ensureValidDocId(mutation.entityId, 'msg');
          const convRef = doc(db, 'users', uid, 'conversations', safeConvId);
          const msgRef = doc(db, 'users', uid, 'conversations', safeConvId, 'messages', safeMsgId);

          const convMeta = context.conversationMeta;
          const deletedIds = (
            convMeta?.deletedMessageIds ||
            (operation === 'delete' ? [safeMsgId] : [])
          ).slice(-MAX_TOMBSTONES_PER_CONVERSATION);
          const deletedSet = new Set(deletedIds);
          const allMsgs = context.conversationMessages || [];
          const previewMessages = deriveConsistentPreviewMessages(allMsgs, safeConvId, deletedSet);

          const batch = writeBatch(db);

          if (operation === 'delete') {
            batch.delete(msgRef);
          } else {
            const normalized = normalizeMessageSchema(payload, safeConvId, 0);
            batch.set(
              msgRef,
              removeUndefined({
                ...normalized,
                id: safeMsgId,
                conversationId: safeConvId,
                revision,
              }),
              { merge: true }
            );
          }

          batch.set(
            convRef,
            removeUndefined({
              id: safeConvId,
              ...(convMeta?.title ? { title: convMeta.title } : {}),
              ...(convMeta?.modelId ? { modelId: convMeta.modelId } : {}),
              ...(convMeta?.createdAt ? { createdAt: convMeta.createdAt } : {}),
              updatedAt: convMeta?.updatedAt || mutation.clientTimestamp,
              revision: Math.max(revision, convMeta?.revision || 0),
              deletedMessageIds: deletedIds,
              messages: previewMessages,
            }),
            { merge: true }
          );

          await batch.commit();
          return;
        }

        case 'companion': {
          const canonicalId = mutation.entityId.replace(/^models\//, '').trim();
          const safeDocId = ensureValidDocId(canonicalId, 'companion');
          const compRef = doc(db, 'users', uid, 'companions', safeDocId);
          if (operation === 'delete') {
            await deleteDoc(compRef);
            return;
          }
          await setDoc(
            compRef,
            removeUndefined({
              ...payload,
              id: canonicalId,
              revision,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }

        case 'companion_memory': {
          const canonicalCompId = (
            mutation.parentId ||
            payload?.entityId ||
            payload?.modelId ||
            ''
          )
            .replace(/^models\//, '')
            .trim();
          if (!canonicalCompId) {
            throw new Error('companionId required for private companion memory mutation');
          }
          const safeCompDocId = ensureValidDocId(canonicalCompId, 'companion');
          const safeMemId = ensureValidDocId(mutation.entityId, 'mem');
          const memRef = doc(
            db,
            'users',
            uid,
            'companions',
            safeCompDocId,
            'memories',
            safeMemId
          );
          if (operation === 'delete') {
            await deleteDoc(memRef);
            return;
          }
          await setDoc(
            memRef,
            removeUndefined({
              ...payload,
              id: safeMemId,
              scope: 'companion',
              entityId: canonicalCompId,
              modelId: canonicalCompId,
              author: 'model',
              revision,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }

        case 'shared_memory': {
          const safeMemId = ensureValidDocId(mutation.entityId, 'mem');
          const memRef = doc(db, 'users', uid, 'memories', safeMemId);
          if (operation === 'delete') {
            await deleteDoc(memRef);
            return;
          }
          await setDoc(
            memRef,
            removeUndefined({
              ...payload,
              id: safeMemId,
              scope: payload?.scope === 'legacy' ? 'legacy' : 'shared',
              revision,
              updatedAt: mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }

        case 'gift': {
          const safeGiftId = ensureValidDocId(mutation.entityId, 'gift');
          const giftRef = doc(db, 'users', uid, 'gifts', safeGiftId);
          if (operation === 'delete') {
            await deleteDoc(giftRef);
            return;
          }
          await setDoc(
            giftRef,
            removeUndefined({
              ...payload,
              id: safeGiftId,
              revision,
              timestamp: payload?.timestamp || mutation.clientTimestamp,
            }),
            { merge: true }
          );
          return;
        }
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Missing or insufficient permissions') || err?.code === 'permission-denied') {
        handleFirestoreError(err, opType, targetPath);
      }
      logFirestoreError(err, opType, targetPath);
      throw err;
    }
  }
}

function resolveMutationPath(uid: string, m: MutationRecord): string {
  switch (m.entityType) {
    case 'settings':
    case 'jewel':
    case 'profile':
      return `users/${uid}/settings/app`;
    case 'conversation':
      return `users/${uid}/conversations/${ensureValidDocId(m.entityId, 'conv')}`;
    case 'message':
      return `users/${uid}/conversations/${ensureValidDocId(m.parentId, 'conv')}/messages/${ensureValidDocId(m.entityId, 'msg')}`;
    case 'companion':
      return `users/${uid}/companions/${ensureValidDocId(m.entityId, 'companion')}`;
    case 'companion_memory':
      return `users/${uid}/companions/${ensureValidDocId(m.parentId, 'companion')}/memories/${ensureValidDocId(m.entityId, 'mem')}`;
    case 'shared_memory':
      return `users/${uid}/memories/${ensureValidDocId(m.entityId, 'mem')}`;
    case 'gift':
      return `users/${uid}/gifts/${ensureValidDocId(m.entityId, 'gift')}`;
  }
}
