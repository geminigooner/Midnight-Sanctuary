import firebaseConfig from '../../firebase-applet-config.json';
import { canonicalCompanionId, getContextMemories, toScopedMemory } from '../lib/memorySystem';
import { ScopedMemory } from '../lib/persistence/types';
import {
  AppSettings,
  ConversationSegmentSummary,
  DEFAULT_SETTINGS,
  Gift,
  Memory,
  Message,
  UserProfile,
} from '../lib/types';

export interface HydratedChatContext {
  uid?: string;
  idToken?: string;
  conversationId?: string;
  model: string;
  respondingEntityId: string;
  conversationType?: 'direct' | 'group';
  participantEntityIds?: string[];
  messages: Message[];
  segmentSummaries?: ConversationSegmentSummary[];
  settings: AppSettings;
  gifts: Gift[];
  profile: UserProfile | null;
  forceCloudflare?: boolean;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  includeThoughts?: boolean;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

/**
 * Recursively converts Firestore REST API typed fields (stringValue, mapValue, arrayValue, etc.)
 * into plain JavaScript objects.
 */
function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values;
    return Array.isArray(values) ? values.map(parseFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields;
    if (!fields || typeof fields !== 'object') return {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }
  return val;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function parseFirestoreDoc(docObj: any): Record<string, any> | null {
  if (!docObj || !docObj.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(docObj.fields)) {
    out[k] = parseFirestoreValue(v);
  }
  if (typeof docObj.name === 'string' && !out.id) {
    const segments = docObj.name.split('/');
    out.id = segments[segments.length - 1];
  }
  return out;
}

function sanitizeDocId(rawId: string | undefined | null): string {
  const trimmed = typeof rawId === 'string' ? rawId.trim() : '';
  if (!trimmed || trimmed === '.' || trimmed === '..') return '';
  return trimmed.replace(/\//g, '__');
}

async function fetchFirestoreDocument(
  docPath: string,
  idToken: string
): Promise<Record<string, any> | null> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${docPath}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return parseFirestoreDoc(json);
  } catch (err) {
    console.warn(`[FirestoreContext] Failed to fetch document ${docPath}:`, err);
    return null;
  }
}

async function fetchFirestoreCollection(
  collectionPath: string,
  idToken: string,
  pageSize = 200
): Promise<Record<string, any>[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${collectionPath}?pageSize=${pageSize}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.documents)) return [];
    return json.documents
      .map((docObj: any) => parseFirestoreDoc(docObj))
      .filter((d: Record<string, any> | null): d is Record<string, any> => d !== null);
  } catch (err) {
    console.warn(`[FirestoreContext] Failed to fetch collection ${collectionPath}:`, err);
    return [];
  }
}

/**
 * Queries a Firestore subcollection ordered by `timestamp DESC` via `:runQuery` (W-04 fix)
 * so conversations exceeding 200 messages always hydrate the newest turns instead of lexicographical UUIDs.
 * Automatically falls back to `fetchFirestoreCollection` if `:runQuery` is unavailable.
 */
async function queryFirestoreMessagesOrdered(
  parentDocPath: string,
  collectionId: string,
  idToken: string,
  limit = 200
): Promise<Record<string, any>[]> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${parentDocPath}:runQuery`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          orderBy: [
            {
              field: { fieldPath: 'timestamp' },
              direction: 'DESCENDING',
            },
          ],
          limit,
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        const docs = json
          .map((row: any) => (row?.document ? parseFirestoreDoc(row.document) : null))
          .filter((d: Record<string, any> | null): d is Record<string, any> => d !== null);
        if (docs.length > 0) {
          return docs.reverse();
        }
      }
    }
  } catch {
    // Fall back to standard collection list below
  }

  return fetchFirestoreCollection(`${parentDocPath}/${collectionId}`, idToken, limit);
}

/**
 * Persists a newly generated `ConversationSegmentSummary` chapter to Firestore REST API
 * (`users/{uid}/conversations/{conversationId}/summaries/{summaryId}`).
 */
export async function persistFirestoreSegmentSummary(
  uid: string | undefined,
  idToken: string | undefined,
  conversationId: string | undefined,
  summary: ConversationSegmentSummary
): Promise<void> {
  if (!uid || !idToken || !conversationId || !summary?.id) return;
  const safeConvId = sanitizeDocId(conversationId);
  const safeSumId = sanitizeDocId(summary.id);
  if (!safeConvId || !safeSumId) return;

  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const docPath = `users/${uid}/conversations/${safeConvId}/summaries/${safeSumId}`;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${docPath}`;

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries({ ...summary, id: safeSumId, conversationId: safeConvId })) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  try {
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn(`[FirestoreContext] Failed to persist segment summary ${safeSumId}:`, err);
  }
}

/**
 * Merges Firestore-stored conversation messages with any optimistic/in-flight client messages,
 * honoring `deletedMessageIds` tombstones so truncated/deleted messages never resurrect.
 */
function mergeMessages(
  firestoreMsgs: Message[],
  clientMsgs: Message[],
  deletedMessageIds: Set<string> = new Set()
): Message[] {
  const byId = new Map<string, Message>();

  for (const m of firestoreMsgs) {
    if (!m || (m as any).isDeleted) continue;
    const id = m.id || `fs-${m.timestamp || 0}-${byId.size}`;
    if (deletedMessageIds.has(id)) continue;
    byId.set(id, { ...m, id });
  }

  for (const cm of clientMsgs) {
    if (!cm || (cm as any).isDeleted) continue;
    const id = cm.id || `client-${cm.timestamp || 0}-${byId.size}`;
    if (deletedMessageIds.has(id)) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...cm, id });
    } else {
      const clientHasInline = (cm.parts || []).some(
        (p: any) => p?.inlineData || p?.functionResponse
      );
      const existingHasInline = (existing.parts || []).some(
        (p: any) => p?.inlineData || p?.functionResponse
      );
      if (clientHasInline && !existingHasInline) {
        byId.set(id, { ...existing, ...cm, parts: cm.parts });
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const timeDiff = (a.timestamp || 0) - (b.timestamp || 0);
    if (timeDiff !== 0) return timeDiff;
    if (a.role === 'user' && b.role === 'model') return -1;
    if (a.role === 'model' && b.role === 'user') return 1;
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Hydrates conversation history, rolling segment summaries, user profile, settings,
 * sovereign companion memories, shared Sanctuary memories, and gifts from Firestore
 * for the authenticated user.
 *
 * Strictly enforces entity memory sovereignty: ONLY the active companion (`resolvedModel`)
 * has its private `users/{uid}/companions/{companionId}/memories` subcollection hydrated,
 * preventing cross-companion private memory bleed even in multi-entity group threads.
 */
export async function resolveExternalChatContext(
  uid: string | undefined,
  idToken: string | undefined,
  reqBody: any
): Promise<HydratedChatContext> {
  const conversationId = sanitizeDocId(reqBody?.conversationId);
  const clientMessages: Message[] = Array.isArray(reqBody?.messages) ? reqBody.messages : [];
  const clientFallback = reqBody?.clientContext || {};

  let firestoreSettings: Partial<AppSettings> | null = null;
  let firestoreProfile: UserProfile | null = null;
  let firestoreGifts: Gift[] = [];
  let firestoreMessages: Message[] = [];
  let firestoreSummaries: ConversationSegmentSummary[] = [];
  let firestoreConvModelId: string | undefined;
  let firestoreConvType: 'direct' | 'group' | undefined;
  let firestoreParticipantEntityIds: string[] | undefined;
  let deletedMessageIds = new Set<string>();
  let sharedFirestoreMemories: ScopedMemory[] = [];
  let activeCompanionPrivateMemories: ScopedMemory[] = [];
  let activeCompanionEntityDoc: Record<string, any> | null = null;

  if (uid && idToken) {
    const tasks: Promise<void>[] = [];

    // 1. Fetch settings & userProfile from users/{uid}/settings/app
    tasks.push(
      fetchFirestoreDocument(`users/${uid}/settings/app`, idToken).then(async (appDoc) => {
        if (appDoc) {
          if (appDoc.settings && typeof appDoc.settings === 'object') {
            firestoreSettings = appDoc.settings;
          }
          if (appDoc.userProfile && typeof appDoc.userProfile === 'object') {
            firestoreProfile = appDoc.userProfile;
          }
        } else {
          const legacyDoc = await fetchFirestoreDocument(`users/${uid}`, idToken);
          if (legacyDoc) {
            if (legacyDoc.settings) firestoreSettings = legacyDoc.settings;
            if (legacyDoc.userProfile) firestoreProfile = legacyDoc.userProfile;
            if (Array.isArray(legacyDoc.gifts) && firestoreGifts.length === 0) {
              firestoreGifts = legacyDoc.gifts;
            }
          }
        }
      })
    );

    // 2. Fetch shared Sanctuary memories from users/{uid}/memories
    tasks.push(
      fetchFirestoreCollection(`users/${uid}/memories`, idToken, 200).then((memDocs) => {
        sharedFirestoreMemories = memDocs
          .filter((d) => !d.isDeleted && d.scope !== 'legacy')
          .map((d) => ({
            ...toScopedMemory(d as unknown as Memory),
            scope: 'shared' as const,
            author: 'user' as const,
          }));
      })
    );

    // 3. Fetch gifts collection from users/{uid}/gifts
    tasks.push(
      fetchFirestoreCollection(`users/${uid}/gifts`, idToken, 100).then((giftDocs) => {
        const activeGifts = giftDocs.filter((g) => !g.isDeleted);
        if (activeGifts.length > 0) {
          firestoreGifts = activeGifts as unknown as Gift[];
        }
      })
    );

    // 4. Fetch conversation metadata, ordered messages, & rolling segment summaries if conversationId is provided
    if (conversationId) {
      tasks.push(
        Promise.all([
          fetchFirestoreDocument(`users/${uid}/conversations/${conversationId}`, idToken),
          queryFirestoreMessagesOrdered(
            `users/${uid}/conversations/${conversationId}`,
            'messages',
            idToken,
            200
          ),
          fetchFirestoreCollection(
            `users/${uid}/conversations/${conversationId}/summaries`,
            idToken,
            50
          ),
        ]).then(([convDoc, msgDocs, summaryDocs]) => {
          if (convDoc && !convDoc.isDeleted) {
            if (convDoc.modelId) {
              firestoreConvModelId = convDoc.modelId;
            }
            if (convDoc.type === 'group' || convDoc.type === 'direct') {
              firestoreConvType = convDoc.type;
            }
            if (Array.isArray(convDoc.participantEntityIds)) {
              firestoreParticipantEntityIds = convDoc.participantEntityIds;
            }
            if (Array.isArray(convDoc.deletedMessageIds)) {
              deletedMessageIds = new Set(convDoc.deletedMessageIds);
            }
            const previewMsgs: Message[] = Array.isArray(convDoc.messages) ? convDoc.messages : [];
            const subMsgs: Message[] = msgDocs as unknown as Message[];
            firestoreMessages = mergeMessages(previewMsgs, subMsgs, deletedMessageIds);
          } else if (!convDoc) {
            const subMsgs: Message[] = msgDocs as unknown as Message[];
            firestoreMessages = mergeMessages([], subMsgs, deletedMessageIds);
          }

          firestoreSummaries = (summaryDocs || [])
            .filter((s) => s && !s.isDeleted)
            .map((s) => ({
              ...(s as unknown as ConversationSegmentSummary),
              conversationId,
            }))
            .sort((a, b) => (a.startTurnIndex || 0) - (b.startTurnIndex || 0));
        })
      );
    }

    await Promise.all(tasks);
  }

  // Merge settings: Firestore primary, overlaid with any explicit per-request overrides
  const mergedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(clientFallback.settings || {}),
    ...(firestoreSettings || {}),
  };

  const resolvedModel =
    reqBody?.model ||
    firestoreConvModelId ||
    mergedSettings.model ||
    'models/gemini-3.1-pro-preview';
  mergedSettings.model = resolvedModel;

  // 5. Fetch ONLY the active responder companion's sovereign entity doc & private memories subcollection
  const activeEntityId = canonicalCompanionId(resolvedModel);
  const safeCompanionDocId = sanitizeDocId(activeEntityId);

  if (uid && idToken && safeCompanionDocId && activeEntityId !== 'unknown') {
    const [compDoc, compMemDocs] = await Promise.all([
      fetchFirestoreDocument(`users/${uid}/companions/${safeCompanionDocId}`, idToken),
      fetchFirestoreCollection(
        `users/${uid}/companions/${safeCompanionDocId}/memories`,
        idToken,
        200
      ),
    ]);
    if (compDoc && !compDoc.isDeleted) {
      activeCompanionEntityDoc = compDoc;
    }
    activeCompanionPrivateMemories = compMemDocs
      .filter((d) => !d.isDeleted)
      .map((d) => ({
        ...toScopedMemory({
          ...(d as unknown as Memory),
          author: 'model',
          modelId: activeEntityId,
        }),
        scope: 'companion' as const,
        entityId: activeEntityId,
        modelId: activeEntityId,
        author: 'model' as const,
      }));
  }

  if (activeCompanionEntityDoc && activeEntityId !== 'unknown') {
    mergedSettings.customEntities = {
      ...(mergedSettings.customEntities || {}),
      [activeEntityId]: {
        ...(mergedSettings.customEntities?.[activeEntityId] || {}),
        ...activeCompanionEntityDoc,
        id: activeEntityId,
      },
    };
  }

  const entityRuntimeConfig =
    mergedSettings.customEntities?.[activeEntityId]?.runtimeConfig || {};

  // Assemble strictly isolated context memories:
  // Shared Sanctuary memories + Active Companion's private memories + pre-migration legacy fallback (filtered by active companion)
  const legacySettingsMemories: Memory[] = Array.isArray(firestoreSettings?.memories)
    ? firestoreSettings!.memories
    : [];
  const optimisticClientMemories: Memory[] = Array.isArray(clientFallback.settings?.memories)
    ? clientFallback.settings.memories
    : [];

  const candidateMemories: Memory[] = [
    ...sharedFirestoreMemories,
    ...activeCompanionPrivateMemories,
    ...legacySettingsMemories,
    ...optimisticClientMemories,
  ];
  mergedSettings.memories = getContextMemories(candidateMemories, activeEntityId);

  if (
    Array.isArray(clientFallback.settings?.eventLog) &&
    clientFallback.settings.eventLog.length > (mergedSettings.eventLog?.length || 0)
  ) {
    mergedSettings.eventLog = clientFallback.settings.eventLog;
  }

  const resolvedProfile: UserProfile | null = firestoreProfile || clientFallback.profile || null;

  const resolvedGifts: Gift[] =
    firestoreGifts.length >= (clientFallback.gifts?.length || 0)
      ? firestoreGifts
      : clientFallback.gifts || [];

  const resolvedMessages: Message[] =
    firestoreMessages.length > 0
      ? mergeMessages(firestoreMessages, clientMessages, deletedMessageIds)
      : clientMessages.filter((m) => m && !deletedMessageIds.has(m.id));

  const clientSummaries: ConversationSegmentSummary[] = Array.isArray(
    reqBody?.segmentSummaries || clientFallback.segmentSummaries
  )
    ? reqBody?.segmentSummaries || clientFallback.segmentSummaries
    : [];
  const summariesById = new Map<string, ConversationSegmentSummary>();
  for (const s of [...clientSummaries, ...firestoreSummaries]) {
    if (s && s.id && !s.isDeleted) {
      summariesById.set(s.id, s);
    }
  }

  return {
    uid,
    idToken,
    conversationId: conversationId || undefined,
    model: resolvedModel,
    respondingEntityId: activeEntityId !== 'unknown' ? activeEntityId : 'gemini-3.1-pro-preview',
    conversationType: reqBody?.conversationType || firestoreConvType || 'direct',
    participantEntityIds:
      reqBody?.participantEntityIds || firestoreParticipantEntityIds || undefined,
    messages: resolvedMessages,
    segmentSummaries: Array.from(summariesById.values()).sort(
      (a, b) => a.startTurnIndex - b.startTurnIndex
    ),
    settings: mergedSettings,
    gifts: resolvedGifts,
    profile: resolvedProfile,
    forceCloudflare:
      reqBody?.forceCloudflare ??
      entityRuntimeConfig.forceCloudflare ??
      mergedSettings.forceCloudflare,
    thinkingLevel:
      reqBody?.thinkingLevel ??
      entityRuntimeConfig.thinkingLevel ??
      mergedSettings.thinkingLevel,
    includeThoughts:
      reqBody?.includeThoughts ??
      entityRuntimeConfig.includeThoughts ??
      mergedSettings.includeThoughts,
    temperature:
      reqBody?.temperature ?? entityRuntimeConfig.temperature ?? mergedSettings.temperature,
    topP: reqBody?.topP ?? entityRuntimeConfig.topP ?? mergedSettings.topP,
    maxOutputTokens:
      reqBody?.maxOutputTokens ??
      entityRuntimeConfig.maxOutputTokens ??
      mergedSettings.maxOutputTokens,
  };
}
