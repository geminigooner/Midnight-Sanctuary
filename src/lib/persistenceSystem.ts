import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, AppSettings, JewelMetrics, Gift, Message, UserProfile } from './types';

export function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        newObj[key] = removeUndefined(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

/**
 * Ensures any document ID used in a Firestore path is non-empty, trimmed,
 * and free of forward slashes ('/') so doc() references never fail segment validation.
 */
export function ensureValidDocId(rawId: string | undefined | null, fallbackPrefix = 'doc'): string {
  const trimmed = typeof rawId === 'string' ? rawId.trim() : '';
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    return `${fallbackPrefix}-${uuidv4()}`;
  }
  return trimmed.replace(/\//g, '__');
}

export function decodeCompanionDocId(docId: string, dataId?: string): string {
  if (typeof dataId === 'string' && dataId.trim().length > 0) {
    return dataId.trim().replace(/^models\//, '');
  }
  return docId.replace(/__/g, '/').replace(/^models\//, '');
}

export function normalizeMessageSchema(
  rawMsg: Partial<Message> | any,
  convId: string,
  indexFallback = 0,
  fallbackTimestamp?: number
): Message {
  const safeConvId = ensureValidDocId(convId, 'conv');
  const resolvedTimestamp =
    typeof rawMsg?.timestamp === 'number' && !Number.isNaN(rawMsg.timestamp) && rawMsg.timestamp > 0
      ? rawMsg.timestamp
      : (fallbackTimestamp || Date.now()) + indexFallback;

  const deterministicFallbackId = `msg-${safeConvId}-${indexFallback}-${resolvedTimestamp}`;
  const safeId = ensureValidDocId(rawMsg?.id || deterministicFallbackId, 'msg');

  const safeParts = Array.isArray(rawMsg?.parts) && rawMsg.parts.length > 0
    ? rawMsg.parts
    : [{ text: typeof rawMsg?.publicText === 'string' ? rawMsg.publicText : '' }];

  return {
    ...(rawMsg || {}),
    id: safeId,
    conversationId: safeConvId,
    role: rawMsg?.role === 'model' ? 'model' : 'user',
    parts: safeParts,
    timestamp: resolvedTimestamp,
  };
}

export interface GranularLoadedState {
  conversations?: Conversation[];
  settings?: AppSettings;
  jewelMetrics?: JewelMetrics;
  gifts?: Gift[];
  userProfile?: UserProfile | null;
  companions?: Record<string, any>;
}

/**
 * Pillar 2: Live Real-Time Multi-Device State Subscription (onSnapshot)
 * Listens to settings, companions, gifts, conversations and granular message streams.
 */
export function subscribeToState(
  userId: string, 
  onData: (data: GranularLoadedState | null) => void
): Unsubscribe {
  if (!userId) return () => {};

  const unsubscribers: Unsubscribe[] = [];
  let isSubscribed = true;

  const liveState: GranularLoadedState = {
    conversations: undefined,
    settings: undefined,
    jewelMetrics: undefined,
    gifts: [],
    userProfile: null,
    companions: {},
  };

  const notify = () => {
    if (!isSubscribed) return;
    onData({
      conversations: liveState.conversations !== undefined ? [...liveState.conversations] : undefined,
      settings: liveState.settings,
      jewelMetrics: liveState.jewelMetrics,
      gifts: [...(liveState.gifts || [])],
      userProfile: liveState.userProfile,
      companions: { ...(liveState.companions || {}) },
    });
  };

  const messageUnsubs = new Map<string, Unsubscribe>();
  const subcollectionMessages = new Map<string, Message[]>();
  const inlinePreviewMessages = new Map<string, Message[]>();

  const sortMessagesDeterministically = (msgs: Message[]): Message[] => {
    return [...msgs].sort((a, b) => {
      const timeDiff = (a.timestamp || 0) - (b.timestamp || 0);
      if (timeDiff !== 0) return timeDiff;
      if (a.role === 'user' && b.role === 'model') return -1;
      if (a.role === 'model' && b.role === 'user') return 1;
      return (a.id || '').localeCompare(b.id || '');
    });
  };

  const mergeConversationMessages = (convId: string, currentLocalMsgs: Message[] = []): Message[] => {
    const subMsgs = subcollectionMessages.get(convId) || [];
    const previewMsgs = inlinePreviewMessages.get(convId) || [];

    // Combine subcollection messages with any inline preview messages not yet in subcollection
    const byId = new Map<string, Message>();
    for (let i = 0; i < previewMsgs.length; i++) {
      const pm = previewMsgs[i];
      if (!pm) continue;
      const norm = normalizeMessageSchema(pm, convId, i);
      byId.set(norm.id, norm);
    }
    for (let i = 0; i < subMsgs.length; i++) {
      const sm = subMsgs[i];
      if (!sm) continue;
      const norm = normalizeMessageSchema(sm, convId, i);
      const existingPreview = byId.get(norm.id);
      // Subcollection has full untruncated data (like inlineData / generatedImages)
      byId.set(norm.id, existingPreview ? { ...existingPreview, ...norm } : norm);
    }

    // Merge with any active/streaming local messages
    for (let i = 0; i < currentLocalMsgs.length; i++) {
      const lm = currentLocalMsgs[i];
      if (!lm) continue;
      const normLocal = normalizeMessageSchema(lm, convId, i);
      const existing = byId.get(normLocal.id);
      if (!existing) {
        byId.set(normLocal.id, normLocal);
      } else {
        const localTextLen = (normLocal.publicText?.length || 0) + (normLocal.parts?.[0]?.text?.length || 0);
        const remoteTextLen = (existing.publicText?.length || 0) + (existing.parts?.[0]?.text?.length || 0);
        if (
          normLocal.thoughtStatus === 'thinking' ||
          normLocal.thoughtStatus === 'error' ||
          localTextLen > remoteTextLen
        ) {
          byId.set(normLocal.id, { ...existing, ...normLocal });
        }
      }
    }

    return sortMessagesDeterministically(Array.from(byId.values()));
  };

  const settingsDocRef = doc(db, 'users', userId, 'settings', 'app');
  const convsColRef = collection(db, 'users', userId, 'conversations');
  const giftsColRef = collection(db, 'users', userId, 'gifts');
  const companionsColRef = collection(db, 'users', userId, 'companions');

  // 1. Real-Time Settings Listener & One-Time Legacy Recovery Check
  let legacyChecked = false;
  const runLegacyRecovery = () => {
    if (legacyChecked) return;
    legacyChecked = true;
    checkLegacyOnce(userId, (legacy) => {
      if (legacy && isSubscribed) {
        if (!liveState.settings && legacy.settings) liveState.settings = legacy.settings;
        if (!liveState.jewelMetrics && legacy.jewelMetrics) liveState.jewelMetrics = legacy.jewelMetrics;
        if (!liveState.userProfile && legacy.userProfile) {
          liveState.userProfile = {
            ...legacy.userProfile,
            id: legacy.userProfile.id || userId,
          };
        }
        if (Array.isArray(legacy.conversations) && legacy.conversations.length > 0) {
          const existingIds = new Set((liveState.conversations || []).map(c => c.id));
          const missingConvs = legacy.conversations
            .filter((c: any) => c && c.id && !existingIds.has(c.id))
            .map((c: any) => {
              const safeConvId = ensureValidDocId(c.id, 'conv');
              const convUpdatedAt = c.updatedAt || c.createdAt || Date.now();
              return {
                ...c,
                id: safeConvId,
                createdAt: c.createdAt || convUpdatedAt,
                updatedAt: convUpdatedAt,
                messages: Array.isArray(c.messages)
                  ? c.messages.map((m: any, idx: number) => normalizeMessageSchema(m, safeConvId, idx, convUpdatedAt))
                  : [],
              };
            });
          if (missingConvs.length > 0) {
            liveState.conversations = [...(liveState.conversations || []), ...missingConvs];
          }
        }
        if (Array.isArray(legacy.gifts) && legacy.gifts.length > 0) {
          const existingGiftIds = new Set((liveState.gifts || []).map(g => g.id));
          const missingGifts = legacy.gifts
            .filter((g: any) => g && g.id && !existingGiftIds.has(g.id))
            .map((g: any) => ({ ...g, id: ensureValidDocId(g.id, 'gift') }));
          if (missingGifts.length > 0) {
            liveState.gifts = [...(liveState.gifts || []), ...missingGifts];
          }
        }
        notify();
      }
    });
  };

  const unsubSettings = onSnapshot(settingsDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.settings) liveState.settings = data.settings;
      if (data.jewelMetrics) liveState.jewelMetrics = data.jewelMetrics;
      if (data.userProfile && typeof data.userProfile === 'object') {
        liveState.userProfile = {
          ...data.userProfile,
          id: data.userProfile.id || userId,
        };
      }
      notify();
      runLegacyRecovery();
    } else {
      runLegacyRecovery();
    }
  }, (err) => {
    console.error('[Realtime Sync] Error on settings snapshot:', err);
    notify();
  });
  unsubscribers.push(unsubSettings);

  // 2. Real-Time Conversations & Messages Listener
  const unsubConvs = onSnapshot(convsColRef, (convsSnap) => {
    const existingConvsMap = new Map((liveState.conversations || []).map(c => [c.id, c]));
    const updatedConvs: Conversation[] = [];
    const activeIds = new Set<string>();

    convsSnap.forEach((cDoc) => {
      const convId = cDoc.id;
      activeIds.add(convId);
      const convMeta = cDoc.data();
      const existing = existingConvsMap.get(convId);
      const resolvedUpdatedAt = convMeta.updatedAt || convMeta.createdAt || existing?.updatedAt || Date.now();
      const resolvedCreatedAt = convMeta.createdAt || existing?.createdAt || resolvedUpdatedAt;

      if (Array.isArray(convMeta.messages) && convMeta.messages.length > 0) {
        inlinePreviewMessages.set(
          convId,
          convMeta.messages.map((m: any, idx: number) =>
            normalizeMessageSchema(m, convId, idx, resolvedUpdatedAt)
          )
        );
      }

      const mergedMsgs = mergeConversationMessages(convId, existing?.messages || []);

      const conv: Conversation = {
        id: convId,
        title: convMeta.title || existing?.title || 'Untitled Conversation',
        modelId: convMeta.modelId || existing?.modelId || 'models/gemini-3.1-pro-preview',
        createdAt: resolvedCreatedAt,
        updatedAt: resolvedUpdatedAt,
        messages: mergedMsgs,
        type: convMeta.type || existing?.type || 'direct',
        participantEntityIds: convMeta.participantEntityIds || existing?.participantEntityIds,
      };
      updatedConvs.push(conv);

      // Deep message subcollection real-time listener (without orderBy so docs lacking timestamp are never excluded)
      if (!messageUnsubs.has(convId)) {
        const msgsColRef = collection(db, 'users', userId, 'conversations', convId, 'messages');

        const unsubMsgs = onSnapshot(msgsColRef, (msgsSnap) => {
          if (!isSubscribed) return;
          const messages: Message[] = [];
          let idx = 0;
          msgsSnap.forEach(mDoc => {
            messages.push(
              normalizeMessageSchema({ ...(mDoc.data() as Message), id: mDoc.id }, convId, idx++)
            );
          });

          subcollectionMessages.set(convId, sortMessagesDeterministically(messages));

          if (liveState.conversations) {
            const targetIdx = liveState.conversations.findIndex(c => c.id === convId);
            if (targetIdx >= 0) {
              const targetConv = liveState.conversations[targetIdx];
              const nextMessages = mergeConversationMessages(convId, targetConv.messages || []);
              const nextConvs = [...liveState.conversations];
              nextConvs[targetIdx] = {
                ...targetConv,
                messages: nextMessages,
              };
              liveState.conversations = nextConvs;
              notify();
            }
          }
        }, (err) => {
          console.error(`[Realtime Sync] Messages snapshot error in conv ${convId}:`, err);
        });

        messageUnsubs.set(convId, unsubMsgs);
      }
    });

    for (const [id, unsub] of messageUnsubs.entries()) {
      if (!activeIds.has(id)) {
        unsub();
        messageUnsubs.delete(id);
        subcollectionMessages.delete(id);
        inlinePreviewMessages.delete(id);
      }
    }

    // Deterministic stable sorting for conversations: updatedAt descending, then id
    updatedConvs.sort((a, b) => {
      const diff = (b.updatedAt || 0) - (a.updatedAt || 0);
      if (diff !== 0) return diff;
      return (a.id || '').localeCompare(b.id || '');
    });
    liveState.conversations = updatedConvs;
    notify();
  }, (err) => {
    console.error('[Realtime Sync] Conversations snapshot error:', err);
    notify();
  });
  unsubscribers.push(unsubConvs);

  // 3. Real-Time Gifts Listener
  const unsubGifts = onSnapshot(giftsColRef, (giftsSnap) => {
    const gifts: Gift[] = [];
    giftsSnap.forEach(gDoc => {
      const gData = gDoc.data() as Gift;
      gifts.push({
        ...gData,
        id: gDoc.id,
        timestamp: gData.timestamp || Date.now(),
      });
    });
    gifts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    liveState.gifts = gifts;
    notify();
  }, (err) => {
    console.error('[Realtime Sync] Gifts snapshot error:', err);
  });
  unsubscribers.push(unsubGifts);

  // 4. Real-Time Companion Quarters Listener
  const unsubCompanions = onSnapshot(companionsColRef, (compsSnap) => {
    const comps: Record<string, any> = {};
    compsSnap.forEach(cDoc => {
      const data = cDoc.data();
      const canonicalKey = decodeCompanionDocId(cDoc.id, data?.id);
      comps[canonicalKey] = {
        ...data,
        id: canonicalKey,
      };
    });
    liveState.companions = comps;
    notify();
  }, (err) => {
    console.error('[Realtime Sync] Companions snapshot error:', err);
  });
  unsubscribers.push(unsubCompanions);

  return () => {
    isSubscribed = false;
    unsubscribers.forEach(unsub => unsub());
    messageUnsubs.forEach(unsub => unsub());
    messageUnsubs.clear();
  };
}

/**
 * Legacy monolithic check for initial migration
 */
async function checkLegacyOnce(userId: string, onLegacy: (data: any) => void) {
  try {
    const legacyDocRef = doc(db, 'users', userId);
    const snap = await getDoc(legacyDocRef);
    if (snap.exists()) {
      const data = snap.data();
      onLegacy(data);
      if (!data.migratedToGranular) {
        migrateLegacyToGranular(userId, data).catch(console.error);
      }
    }
  } catch (err) {
    console.error('[Realtime Sync] Legacy check error:', err);
  }
}

/**
 * Migration helper
 */
export async function migrateLegacyToGranular(userId: string, legacyData: any) {
  if (!userId || !legacyData) return;

  try {
    if (legacyData.settings || legacyData.jewelMetrics || legacyData.userProfile) {
      const settingsRef = doc(db, 'users', userId, 'settings', 'app');
      const settingsPayload: Record<string, any> = {
        id: 'app',
        userId,
        updatedAt: Date.now(),
      };
      if (legacyData.settings) settingsPayload.settings = legacyData.settings;
      if (legacyData.jewelMetrics) settingsPayload.jewelMetrics = legacyData.jewelMetrics;
      if (legacyData.userProfile) {
        settingsPayload.userProfile = {
          ...legacyData.userProfile,
          id: legacyData.userProfile.id || userId,
        };
      }
      await setDoc(settingsRef, removeUndefined(settingsPayload), { merge: true });
    }

    if (Array.isArray(legacyData.conversations) && legacyData.conversations.length > 0) {
      for (const conv of legacyData.conversations) {
        if (!conv) continue;
        await saveConversationDoc(userId, {
          ...conv,
          id: ensureValidDocId(conv.id, 'conv'),
        });
      }
    }

    if (Array.isArray(legacyData.gifts) && legacyData.gifts.length > 0) {
      const giftBatch = writeBatch(db);
      for (const gift of legacyData.gifts) {
        if (!gift) continue;
        const safeGiftId = ensureValidDocId(gift.id, 'gift');
        const giftRef = doc(db, 'users', userId, 'gifts', safeGiftId);
        giftBatch.set(giftRef, removeUndefined({ ...gift, id: safeGiftId }), { merge: true });
      }
      await giftBatch.commit();
    }

    const rootUserDocRef = doc(db, 'users', userId);
    await setDoc(rootUserDocRef, {
      id: userId,
      migratedToGranular: true,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('[Migration] Failed during granular migration:', err);
  }
}

// -------------------------------------------------------------
// Granular Real-Time Save Handlers
// -------------------------------------------------------------

export async function saveSettingsDoc(
  userId: string, 
  settings: AppSettings, 
  jewelMetrics?: JewelMetrics, 
  userProfile?: UserProfile | null
) {
  if (!userId) return;
  const settingsRef = doc(db, 'users', userId, 'settings', 'app');
  const payload: Record<string, any> = {
    id: 'app',
    userId,
    settings,
    updatedAt: Date.now(),
  };
  if (jewelMetrics !== undefined && jewelMetrics !== null) {
    payload.jewelMetrics = jewelMetrics;
  }
  // Never overwrite an existing userProfile in Firestore with null during initial component mount
  if (userProfile && typeof userProfile === 'object') {
    payload.userProfile = {
      ...userProfile,
      id: userProfile.id || userId,
      updatedAt: userProfile.updatedAt || Date.now(),
    };
  }
  return setDoc(settingsRef, removeUndefined(payload), { merge: true });
}

export async function saveProfileDoc(userId: string, userProfile: UserProfile) {
  if (!userId || !userProfile) return;
  const settingsRef = doc(db, 'users', userId, 'settings', 'app');
  const rootUserRef = doc(db, 'users', userId);
  const indexedProfile: UserProfile = {
    ...userProfile,
    id: userProfile.id || userId,
    updatedAt: Date.now(),
  };
  await Promise.all([
    setDoc(settingsRef, removeUndefined({
      id: 'app',
      userId,
      userProfile: indexedProfile,
      updatedAt: Date.now(),
    }), { merge: true }),
    setDoc(rootUserRef, removeUndefined({
      id: userId,
      userProfile: indexedProfile,
      updatedAt: Date.now(),
    }), { merge: true }),
  ]);
}

function sanitizePreviewMessage(m: Message, convId: string, idx = 0): Message {
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
    ? generatedImages.filter(img => img && typeof img.imageUrl === 'string' && !img.imageUrl.startsWith('data:'))
    : undefined;
  return {
    ...mRest,
    parts: cleanParts,
    ...(cleanGeneratedImages && cleanGeneratedImages.length > 0 ? { generatedImages: cleanGeneratedImages } : {}),
  };
}

export async function saveConversationDoc(userId: string, conv: Conversation) {
  if (!userId || !conv) return;
  const safeConvId = ensureValidDocId(conv.id, 'conv');
  const convRef = doc(db, 'users', userId, 'conversations', safeConvId);
  const { messages, ...meta } = conv;
  const now = Date.now();
  const resolvedUpdatedAt = conv.updatedAt || now;
  const resolvedCreatedAt = conv.createdAt || resolvedUpdatedAt;

  const normalizedMessages = Array.isArray(messages)
    ? messages.map((m, idx) => normalizeMessageSchema(m, safeConvId, idx, resolvedUpdatedAt))
    : [];

  // Store the most recent messages directly on the conversation doc for instant 1st-frame snapshot loading
  const previewMessages = normalizedMessages
    .slice(-25)
    .map((m, idx) => sanitizePreviewMessage(m, safeConvId, idx));

  await setDoc(convRef, removeUndefined({
    ...meta,
    id: safeConvId,
    title: conv.title || 'Untitled Sanctuary',
    modelId: conv.modelId || 'models/gemini-3.1-pro-preview',
    createdAt: resolvedCreatedAt,
    updatedAt: resolvedUpdatedAt,
    messages: previewMessages,
  }), { merge: true });

  if (normalizedMessages.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const msg of normalizedMessages) {
      if (!msg || !msg.id) continue;
      const msgRef = doc(db, 'users', userId, 'conversations', safeConvId, 'messages', msg.id);
      batch.set(msgRef, removeUndefined(msg), { merge: true });
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
}

export async function saveMessageDoc(userId: string, convId: string, message: Message, allMessages?: Message[]) {
  if (!userId || !convId || !message) return;
  const safeConvId = ensureValidDocId(convId, 'conv');
  const normalizedMsg = normalizeMessageSchema(message, safeConvId, 0);
  const msgRef = doc(db, 'users', userId, 'conversations', safeConvId, 'messages', normalizedMsg.id);
  const convRef = doc(db, 'users', userId, 'conversations', safeConvId);

  const convUpdate: any = {
    id: safeConvId,
    updatedAt: normalizedMsg.timestamp || Date.now()
  };

  if (Array.isArray(allMessages) && allMessages.length > 0) {
    convUpdate.messages = allMessages
      .slice(-25)
      .map((m, idx) => sanitizePreviewMessage(m, safeConvId, idx));
  }

  await Promise.all([
    setDoc(msgRef, removeUndefined(normalizedMsg), { merge: true }),
    setDoc(convRef, removeUndefined(convUpdate), { merge: true }),
  ]);
}

export async function deleteMessageDoc(userId: string, convId: string, messageId: string) {
  if (!userId || !convId || !messageId) return;
  const safeConvId = ensureValidDocId(convId, 'conv');
  const safeMsgId = ensureValidDocId(messageId, 'msg');
  const msgRef = doc(db, 'users', userId, 'conversations', safeConvId, 'messages', safeMsgId);
  return deleteDoc(msgRef);
}

export async function deleteConversationDocs(userId: string, convId: string) {
  if (!userId || !convId) return;
  const safeConvId = ensureValidDocId(convId, 'conv');
  const convRef = doc(db, 'users', userId, 'conversations', safeConvId);
  const messagesRef = collection(db, 'users', userId, 'conversations', safeConvId, 'messages');
  
  const msgSnap = await getDocs(messagesRef).catch(() => null);
  if (msgSnap && !msgSnap.empty) {
    const batch = writeBatch(db);
    msgSnap.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
  return deleteDoc(convRef);
}

export async function saveGiftDoc(userId: string, gift: Gift) {
  if (!userId || !gift) return;
  const safeGiftId = ensureValidDocId(gift.id, 'gift');
  const giftRef = doc(db, 'users', userId, 'gifts', safeGiftId);
  return setDoc(giftRef, removeUndefined({
    ...gift,
    id: safeGiftId,
    timestamp: gift.timestamp || Date.now(),
  }), { merge: true });
}

export async function saveCompanionDoc(userId: string, companionId: string, companionData: any) {
  if (!userId || !companionId || !companionData) return;
  const canonicalId = companionId.replace(/^models\//, '');
  const safeDocId = ensureValidDocId(canonicalId, 'companion');
  const companionRef = doc(db, 'users', userId, 'companions', safeDocId);
  return setDoc(companionRef, removeUndefined({
    ...companionData,
    id: canonicalId,
    updatedAt: Date.now(),
  }), { merge: true });
}

export async function saveFullGranularState(userId: string, payload: {
  conversations?: Conversation[];
  settings?: AppSettings;
  jewelMetrics?: JewelMetrics;
  gifts?: Gift[];
  userProfile?: UserProfile | null;
}) {
  if (!userId || !payload) return;

  const promises: Promise<any>[] = [];

  if (payload.settings) {
    promises.push(saveSettingsDoc(userId, payload.settings, payload.jewelMetrics, payload.userProfile));

    if (payload.settings.customEntities && typeof payload.settings.customEntities === 'object') {
      for (const [compKey, compData] of Object.entries(payload.settings.customEntities)) {
        if (compKey && compData) {
          promises.push(saveCompanionDoc(userId, compKey, compData));
        }
      }
    }
  }

  // Ensure any active conversations are persisted while strictly preserving each conversation's existing updatedAt
  if (Array.isArray(payload.conversations) && payload.conversations.length > 0) {
    for (const conv of payload.conversations.slice(0, 15)) {
      if (conv?.id) {
        const safeConvId = ensureValidDocId(conv.id, 'conv');
        const convRef = doc(db, 'users', userId, 'conversations', safeConvId);
        const { messages, ...meta } = conv;
        const resolvedUpdatedAt = conv.updatedAt || Date.now();
        const resolvedCreatedAt = conv.createdAt || resolvedUpdatedAt;
        const previewMessages = Array.isArray(messages)
          ? messages.slice(-25).map((m, idx) => sanitizePreviewMessage(m, safeConvId, idx))
          : [];
        promises.push(
          setDoc(convRef, removeUndefined({
            ...meta,
            id: safeConvId,
            createdAt: resolvedCreatedAt,
            updatedAt: resolvedUpdatedAt,
            messages: previewMessages,
          }), { merge: true })
        );
      }
    }
  }

  if (Array.isArray(payload.gifts) && payload.gifts.length > 0) {
    for (const gift of payload.gifts) {
      if (gift?.id) {
        promises.push(saveGiftDoc(userId, gift));
      }
    }
  }

  const rootDocPayload: Record<string, any> = {
    id: userId,
    updatedAt: Date.now(),
    migratedToGranular: true,
  };
  if (payload.userProfile && typeof payload.userProfile === 'object') {
    rootDocPayload.userProfile = {
      ...payload.userProfile,
      id: payload.userProfile.id || userId,
    };
  }

  promises.push(
    setDoc(doc(db, 'users', userId), removeUndefined(rootDocPayload), { merge: true })
  );

  await Promise.all(promises);
}

// Alias for loadState -> subscribeToState
export const loadState = subscribeToState;
export const saveConversation = saveFullGranularState;
export const saveMemory = saveFullGranularState;
export const saveGift = saveFullGranularState;
export const saveSettings = saveFullGranularState;
