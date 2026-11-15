import { v4 as uuidv4 } from 'uuid';
import { auth } from '../firebase';
import { Message } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = logFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}

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

  const safeParts =
    Array.isArray(rawMsg?.parts) && rawMsg.parts.length > 0
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
