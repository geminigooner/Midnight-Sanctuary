import { MutationEntityType, MutationRecord, SyncClientCursor } from './types';

/**
 * Ack-Gated Soft-Delete Tombstone & Causal Lane Protocol
 *
 * Ensures that:
 * 1. Deletions synchronize across all signed-in devices via soft-delete tombstones (`isDeleted: true`)
 *    without ever being resurrected by stale offline caches.
 * 2. Local records that were previously synchronized (`lastSyncedRevision !== undefined`) are NEVER
 *    re-uploaded to Firestore if absent from a remote snapshot.
 * 3. Tombstones are only eligible for physical compaction after ALL active registered client cursors
 *    have acknowledged a timestamp >= `deletedAt` AND a minimum recovery floor has elapsed.
 * 4. Journal execution is partitioned into independent causal lanes so a failing write on one entity
 *    never causes head-of-line blocking for unrelated conversations, memories, or settings.
 */

export const TOMBSTONE_RECOVERY_FLOOR_MS = 7 * 24 * 60 * 60 * 1000; // 7 days minimum undo/recovery floor
export const ACTIVE_CLIENT_CURSOR_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days active device window

export type ErrorClassification = 'transient' | 'permanent_policy';

/**
 * Classifies a cloud persistence error into:
 * - `'permanent_policy'`: Firestore security rule rejection (`permission-denied`), schema/size violation
 *   (`invalid-argument`, `out-of-range`, `> 1048576 bytes`), or unrecoverable syntax error.
 *   Quarantined quickly into `failed` so it never loops endlessly or blocks other writes.
 * - `'transient'`: Network drop, timeout, rate limit (`resource-exhausted`), `unavailable`, or internal error.
 *   Retried with bounded exponential backoff + jitter.
 */
export function classifyMutationError(err: unknown): ErrorClassification {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();

  if (
    code.includes('permission-denied') ||
    code.includes('invalid-argument') ||
    code.includes('failed-precondition') ||
    code.includes('out-of-range') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission_denied') ||
    msg.includes('exceeds the maximum allowed size') ||
    msg.includes('document cannot be larger than') ||
    msg.includes('invalid argument')
  ) {
    return 'permanent_policy';
  }

  return 'transient';
}

/**
 * Computes the independent causal lane key for a mutation.
 * Mutations within the same lane execute strictly in sequence order (e.g., conversation creation before its messages),
 * while independent lanes (e.g., Conversation A vs. Conversation B vs. Shared Memory M) never block each other.
 */
export function resolveCausalLaneKey(
  m: Pick<MutationRecord, 'entityType' | 'entityId' | 'parentId'>
): string {
  switch (m.entityType) {
    case 'conversation':
      return `conv_lane::${m.entityId}`;
    case 'message':
      return `conv_lane::${m.parentId || m.entityId}`;
    case 'companion':
      return `comp_lane::${m.entityId}`;
    case 'companion_memory':
      return `comp_mem_lane::${m.parentId || 'unknown'}::${m.entityId}`;
    case 'companion_vault_asset':
      return `comp_vault_lane::${m.parentId || 'unknown'}::${m.entityId}`;
    case 'shared_memory':
      return `shared_mem_lane::${m.entityId}`;
    case 'shared_vault_asset':
      return `shared_vault_lane::${m.entityId}`;
    case 'gift':
      return `gift_lane::${m.entityId}`;
    case 'media_asset':
      return `media_lane::${m.entityId}`;
    case 'conversation_summary':
      return `summary_lane::${m.parentId || 'unknown'}::${m.entityId}`;
    case 'settings':
    case 'jewel':
    case 'profile':
      return `user_settings_lane::${m.entityType}`;
    default:
      return `default_lane::${(m as any).entityType}::${m.entityId}`;
  }
}

/**
 * Determines whether a local record that is absent from a remote cloud snapshot
 * is genuinely an unsynced offline creation that should be backfilled to Firestore,
 * OR a previously synced record that was deleted/compacted remotely and must be purged locally.
 */
export function shouldBackfillLocalRecordToCloud(params: {
  isDeleted?: boolean;
  lastSyncedRevision?: number;
  hasPendingLocalMutation: boolean;
}): boolean {
  if (params.isDeleted) return false;
  // If the record already has a pending mutation in the local journal, flushJournal will handle it
  if (params.hasPendingLocalMutation) return false;
  // CRITICAL: If `lastSyncedRevision` is defined (> 0), this record was ALREADY synchronized with Firestore
  // in the past. Its absence from the remote snapshot means it was deleted on another device!
  if (typeof params.lastSyncedRevision === 'number' && params.lastSyncedRevision > 0) {
    return false;
  }
  return true;
}

/**
 * Determines whether a soft-delete tombstone (`isDeleted: true`) can be safely physically compacted
 * without risking resurrection on any active signed-in device.
 *
 * Compaction is ONLY allowed when:
 * 1. The tombstone has `deletedAt` older than `TOMBSTONE_RECOVERY_FLOOR_MS` (unless `ignoreRecoveryFloor` is set in tests), AND
 * 2. At least one active client cursor is registered, AND
 * 3. EVERY active registered client (`lastSeenAt` within `ACTIVE_CLIENT_CURSOR_TTL_MS`) has
 *    `lastAckedTimestamp >= deletedAt` and `lastAckedRevision >= tombstoneRevision`.
 */
export function isTombstoneEligibleForCompaction(params: {
  deletedAt?: number;
  tombstoneRevision: number;
  syncClients: Record<string, SyncClientCursor> | undefined;
  now?: number;
  recoveryFloorMs?: number;
}): boolean {
  const now = params.now ?? Date.now();
  const floorMs = params.recoveryFloorMs ?? TOMBSTONE_RECOVERY_FLOOR_MS;
  const deletedAt = params.deletedAt || 0;
  if (!deletedAt) return false;

  if (now - deletedAt < floorMs) {
    return false;
  }

  const clients = Object.values(params.syncClients || {}).filter(
    (c) => c && c.clientId && now - (c.lastSeenAt || 0) <= ACTIVE_CLIENT_CURSOR_TTL_MS
  );

  if (clients.length === 0) {
    return false;
  }

  return clients.every(
    (c) =>
      (c.lastAckedTimestamp || 0) >= deletedAt &&
      (c.lastAckedRevision || 0) >= params.tombstoneRevision
  );
}
