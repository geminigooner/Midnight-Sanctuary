import firebaseConfig from '../../firebase-applet-config.json';
import { AppSettings, DEFAULT_SETTINGS, Gift, Message, UserProfile } from '../lib/types';

export interface HydratedChatContext {
  conversationId?: string;
  model: string;
  messages: Message[];
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
 * Merges Firestore-stored conversation messages with any optimistic/in-flight client messages
 * (such as the latest user message or inline base64 attachment that was just submitted).
 */
function mergeMessages(firestoreMsgs: Message[], clientMsgs: Message[]): Message[] {
  const byId = new Map<string, Message>();

  for (const m of firestoreMsgs) {
    if (!m) continue;
    const id = m.id || `fs-${m.timestamp || 0}-${byId.size}`;
    byId.set(id, { ...m, id });
  }

  for (const cm of clientMsgs) {
    if (!cm) continue;
    const id = cm.id || `client-${cm.timestamp || 0}-${byId.size}`;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...cm, id });
    } else {
      // Preserve inlineData or functionResponse from client if stripped in Firestore preview
      const clientHasInline = (cm.parts || []).some((p: any) => p?.inlineData || p?.functionResponse);
      const existingHasInline = (existing.parts || []).some((p: any) => p?.inlineData || p?.functionResponse);
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
 * Hydrates conversation history, user profile, settings, memories, and gifts from Firestore
 * for the authenticated user, falling back gracefully to client-supplied state when needed.
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
  let firestoreConvModelId: string | undefined;

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
          // Legacy fallback: users/{uid}
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

    // 2. Fetch gifts collection from users/{uid}/gifts
    tasks.push(
      fetchFirestoreCollection(`users/${uid}/gifts`, idToken, 100).then((giftDocs) => {
        if (giftDocs.length > 0) {
          firestoreGifts = giftDocs as unknown as Gift[];
        }
      })
    );

    // 3. Fetch conversation metadata & messages subcollection if conversationId is provided
    if (conversationId) {
      tasks.push(
        Promise.all([
          fetchFirestoreDocument(`users/${uid}/conversations/${conversationId}`, idToken),
          fetchFirestoreCollection(
            `users/${uid}/conversations/${conversationId}/messages`,
            idToken,
            200
          ),
        ]).then(([convDoc, msgDocs]) => {
          if (convDoc?.modelId) {
            firestoreConvModelId = convDoc.modelId;
          }
          const previewMsgs: Message[] = Array.isArray(convDoc?.messages) ? convDoc!.messages : [];
          const subMsgs: Message[] = msgDocs as unknown as Message[];
          firestoreMessages = mergeMessages(previewMsgs, subMsgs);
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

  // Preserve memories or eventLog if client has a newer optimistic item not yet flushed
  if (
    Array.isArray(clientFallback.settings?.memories) &&
    clientFallback.settings.memories.length > (mergedSettings.memories?.length || 0)
  ) {
    mergedSettings.memories = clientFallback.settings.memories;
  }
  if (
    Array.isArray(clientFallback.settings?.eventLog) &&
    clientFallback.settings.eventLog.length > (mergedSettings.eventLog?.length || 0)
  ) {
    mergedSettings.eventLog = clientFallback.settings.eventLog;
  }

  const resolvedModel =
    reqBody?.model ||
    firestoreConvModelId ||
    mergedSettings.model ||
    'models/gemini-3.1-pro-preview';
  mergedSettings.model = resolvedModel;

  const resolvedProfile: UserProfile | null =
    firestoreProfile || clientFallback.profile || null;

  const resolvedGifts: Gift[] =
    firestoreGifts.length >= (clientFallback.gifts?.length || 0)
      ? firestoreGifts
      : clientFallback.gifts || [];

  const resolvedMessages: Message[] =
    firestoreMessages.length > 0
      ? mergeMessages(firestoreMessages, clientMessages)
      : clientMessages;

  return {
    conversationId: conversationId || undefined,
    model: resolvedModel,
    messages: resolvedMessages,
    settings: mergedSettings,
    gifts: resolvedGifts,
    profile: resolvedProfile,
    forceCloudflare: reqBody?.forceCloudflare ?? mergedSettings.forceCloudflare,
    thinkingLevel: reqBody?.thinkingLevel ?? mergedSettings.thinkingLevel,
    includeThoughts: reqBody?.includeThoughts ?? mergedSettings.includeThoughts,
    temperature: reqBody?.temperature ?? mergedSettings.temperature,
    topP: reqBody?.topP ?? mergedSettings.topP,
    maxOutputTokens: reqBody?.maxOutputTokens ?? mergedSettings.maxOutputTokens,
  };
}
