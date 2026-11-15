import { canonicalCompanionId, classifyMemoryScope, toScopedMemory } from '../memorySystem';
import { ensureValidDocId, normalizeMessageSchema } from '../persistenceSystem';
import {
  AppSettings,
  Conversation,
  DEFAULT_JEWEL_METRICS,
  DEFAULT_SETTINGS,
  Gift,
  JewelMetrics,
  Message,
  UserProfile,
} from '../types';
import { ModelEntity } from '../entitySystem';
import { CoordinatorDomainState, PersistenceCoordinator } from './persistenceCoordinator';
import {
  SanctuaryBackupData,
  SanctuaryBackupEnvelope,
  SanctuaryBackupManifest,
  ScopedMemory,
  ValidatedBackupPreview,
} from './types';

export const CURRENT_BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_FORMAT_ID = 'midnight-sanctuary-backup';
export const APP_BACKUP_VERSION = '2.0.0';

/**
 * Deterministic FNV-1a 64-bit-style dual-lane checksum over canonical JSON representation.
 * Runs synchronously in both Browser and Node/Vitest without external dependencies.
 */
export function computeBackupChecksum(data: SanctuaryBackupData): string {
  const canonical = canonicalizeJson(data);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + (i & 0xff);
    h2 = Math.imul(h2, 0x811c9dc5);
  }
  return `fnv2-${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalizeJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(record[k])}`).join(',')}}`;
  }
  return 'null';
}

export function buildBackupManifest(data: SanctuaryBackupData): SanctuaryBackupManifest {
  const totalMessages = (data.conversations || []).reduce(
    (sum, c) => sum + (Array.isArray(c.messages) ? c.messages.length : 0),
    0
  );
  const privateMemories = Object.values(data.companionMemories || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );

  return {
    conversations: (data.conversations || []).length,
    messages: totalMessages,
    companions: Object.keys(data.companions || {}).length,
    privateMemories,
    sharedMemories: (data.sharedMemories || []).length,
    legacyMemories: (data.legacyMemories || []).length,
    gifts: (data.gifts || []).length,
    stickers: (data.settings?.stickers || []).length,
  };
}

/**
 * Exports the complete, untruncated Sanctuary state into a versioned `schemaVersion: 2` envelope.
 */
export function exportSanctuaryBackup(state: CoordinatorDomainState): SanctuaryBackupEnvelope {
  const now = Date.now();

  const sharedOnly: ScopedMemory[] = [];
  const legacyOnly: ScopedMemory[] = [];
  for (const sm of state.sharedMemories || []) {
    if (sm.isDeleted) continue;
    if (sm.scope === 'legacy') {
      legacyOnly.push(sm);
    } else {
      sharedOnly.push({ ...sm, scope: 'shared' });
    }
  }

  const cleanCompanionMemories: Record<string, ScopedMemory[]> = {};
  for (const [entityId, list] of Object.entries(state.companionMemories || {})) {
    const active = (list || [])
      .filter((m) => !m.isDeleted)
      .map((m) => ({
        ...m,
        scope: 'companion' as const,
        entityId: canonicalCompanionId(entityId),
        modelId: canonicalCompanionId(entityId),
        author: 'model' as const,
      }));
    if (active.length > 0) {
      cleanCompanionMemories[canonicalCompanionId(entityId)] = active;
    }
  }

  const cleanSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...state.settings,
    memories: [],
  };

  const data: SanctuaryBackupData = {
    settings: cleanSettings,
    jewelMetrics: {
      ...DEFAULT_JEWEL_METRICS,
      ...state.jewelMetrics,
    },
    userProfile: state.userProfile ? { ...state.userProfile } : null,
    conversations: (state.conversations || []).map((c) => ({
      ...c,
      messages: (c.messages || []).map((m) => ({ ...m })),
    })),
    companions: { ...(state.companions || {}) },
    companionMemories: cleanCompanionMemories,
    sharedMemories: sharedOnly,
    legacyMemories: legacyOnly,
    gifts: (state.gifts || []).map((g) => ({ ...g })),
  };

  const manifest = buildBackupManifest(data);
  const checksum = computeBackupChecksum(data);

  return {
    format: BACKUP_FORMAT_ID,
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    appVersion: APP_BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    exportedTimestamp: now,
    checksum,
    manifest,
    data,
  };
}

/**
 * Parses and validates a raw JSON string or object into a `ValidatedBackupPreview`.
 * Supports both `schemaVersion: 2` Sanctuary envelopes and legacy v1 state exports.
 */
export function validateSanctuaryBackup(rawInput: string | unknown): ValidatedBackupPreview {
  const emptyManifest: SanctuaryBackupManifest = {
    conversations: 0,
    messages: 0,
    companions: 0,
    privateMemories: 0,
    sharedMemories: 0,
    legacyMemories: 0,
    gifts: 0,
    stickers: 0,
  };

  let parsed: any;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch (err: any) {
      return {
        valid: false,
        schemaVersionDetected: 0,
        checksumVerified: false,
        exportedAt: null,
        manifest: emptyManifest,
        warnings: [],
        errors: [`Invalid JSON format: ${err?.message || 'Unable to parse backup file'}`],
      };
    }
  } else {
    parsed = rawInput;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      schemaVersionDetected: 0,
      checksumVerified: false,
      exportedAt: null,
      manifest: emptyManifest,
      warnings: [],
      errors: ['Backup root must be a JSON object.'],
    };
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  // Detect schema version
  let schemaVersionDetected = 1;
  let sourceData: any = parsed;
  let providedChecksum: string | null = null;
  let exportedAt: string | null = null;

  if (parsed.format === BACKUP_FORMAT_ID || typeof parsed.schemaVersion === 'number') {
    schemaVersionDetected = Number(parsed.schemaVersion || 0);
    if (schemaVersionDetected > CURRENT_BACKUP_SCHEMA_VERSION) {
      return {
        valid: false,
        schemaVersionDetected,
        checksumVerified: false,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
        manifest: emptyManifest,
        warnings,
        errors: [
          `Unsupported backup schemaVersion ${schemaVersionDetected}. Maximum supported version is ${CURRENT_BACKUP_SCHEMA_VERSION}.`,
        ],
      };
    }
    if (schemaVersionDetected < 1) {
      errors.push('Invalid backup schemaVersion.');
    }
    sourceData = parsed.data;
    providedChecksum = typeof parsed.checksum === 'string' ? parsed.checksum : null;
    exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  } else if (
    parsed.conversations !== undefined ||
    parsed.settings !== undefined ||
    parsed.gifts !== undefined ||
    parsed.companions !== undefined
  ) {
    schemaVersionDetected = 1;
    warnings.push('Legacy v1 state format detected; upgrading memories and entities to schema v2.');
  } else {
    return {
      valid: false,
      schemaVersionDetected: 0,
      checksumVerified: false,
      exportedAt: null,
      manifest: emptyManifest,
      warnings: [],
      errors: ['Unrecognized backup structure: missing `data` envelope or Sanctuary collections.'],
    };
  }

  if (!sourceData || typeof sourceData !== 'object') {
    return {
      valid: false,
      schemaVersionDetected,
      checksumVerified: false,
      exportedAt,
      manifest: emptyManifest,
      warnings,
      errors: ['Backup `data` payload is missing or malformed.'],
    };
  }

  let checksumVerified = false;
  if (schemaVersionDetected === 2 && providedChecksum) {
    const recomputed = computeBackupChecksum(sourceData as SanctuaryBackupData);
    if (recomputed === providedChecksum) {
      checksumVerified = true;
    } else {
      errors.push(
        `Backup integrity checksum mismatch (expected ${providedChecksum}, computed ${recomputed}).`
      );
    }
  } else if (schemaVersionDetected === 2 && !providedChecksum) {
    warnings.push('No checksum present on v2 envelope; proceeding with structural validation.');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      schemaVersionDetected,
      checksumVerified,
      exportedAt,
      manifest: emptyManifest,
      warnings,
      errors,
    };
  }

  // Normalize conversations & messages
  const normalizedConversations: Conversation[] = [];
  if (sourceData.conversations !== undefined) {
    if (!Array.isArray(sourceData.conversations)) {
      errors.push('`conversations` must be an array.');
    } else {
      for (const rawConv of sourceData.conversations) {
        if (!rawConv || typeof rawConv !== 'object') continue;
        const safeConvId = ensureValidDocId(rawConv.id, 'conv');
        const updatedAt =
          typeof rawConv.updatedAt === 'number'
            ? rawConv.updatedAt
            : typeof rawConv.createdAt === 'number'
            ? rawConv.createdAt
            : Date.now();
        const rawMsgs = Array.isArray(rawConv.messages) ? rawConv.messages : [];
        const normalizedMsgs: Message[] = rawMsgs
          .filter((m: any) => m && typeof m === 'object')
          .map((m: any, idx: number) => normalizeMessageSchema(m, safeConvId, idx, updatedAt));
        normalizedConversations.push({
          id: safeConvId,
          title: typeof rawConv.title === 'string' && rawConv.title.trim() ? rawConv.title : 'Restored Sanctuary',
          modelId: rawConv.modelId || 'models/gemini-3.1-pro-preview',
          createdAt: typeof rawConv.createdAt === 'number' ? rawConv.createdAt : updatedAt,
          updatedAt,
          type: rawConv.type === 'group' ? 'group' : 'direct',
          participantEntityIds: Array.isArray(rawConv.participantEntityIds)
            ? rawConv.participantEntityIds
            : undefined,
          messages: normalizedMsgs,
        });
      }
    }
  }

  // Normalize companions (from both `companions` and legacy `settings.customEntities`)
  const normalizedCompanions: Record<string, ModelEntity> = {};
  const rawCustomEntities = sourceData.settings?.customEntities || {};
  for (const [key, val] of Object.entries({ ...rawCustomEntities, ...(sourceData.companions || {}) })) {
    if (!val || typeof val !== 'object') continue;
    const cid = canonicalCompanionId(key);
    if (cid && cid !== 'unknown') {
      normalizedCompanions[cid] = {
        ...(val as ModelEntity),
        id: cid,
      };
    }
  }

  // Normalize private companion memories, shared memories, and legacy flat memories
  const companionMemories: Record<string, ScopedMemory[]> = {};
  const sharedMemoriesMap = new Map<string, ScopedMemory>();
  const legacyMemoriesMap = new Map<string, ScopedMemory>();

  if (sourceData.companionMemories && typeof sourceData.companionMemories === 'object') {
    for (const [entityKey, memList] of Object.entries(sourceData.companionMemories)) {
      if (!Array.isArray(memList)) continue;
      const cid = canonicalCompanionId(entityKey);
      if (!cid || cid === 'unknown') continue;
      const bucket = companionMemories[cid] || [];
      for (const rm of memList) {
        if (!rm || typeof rm.content !== 'string' || !rm.content.trim()) continue;
        const scoped = toScopedMemory({ ...rm, author: 'model', modelId: cid });
        bucket.push({
          ...scoped,
          id: ensureValidDocId(scoped.id, 'mem'),
          scope: 'companion',
          entityId: cid,
          modelId: cid,
          author: 'model',
        });
      }
      if (bucket.length > 0) {
        companionMemories[cid] = bucket;
      }
    }
  }

  if (Array.isArray(sourceData.sharedMemories)) {
    for (const sm of sourceData.sharedMemories) {
      if (!sm || typeof sm.content !== 'string' || !sm.content.trim()) continue;
      const scoped = toScopedMemory({ ...sm, author: 'user' });
      const cleanId = ensureValidDocId(scoped.id, 'mem');
      sharedMemoriesMap.set(cleanId, {
        ...scoped,
        id: cleanId,
        scope: 'shared',
        author: 'user',
      });
    }
  }

  if (Array.isArray(sourceData.legacyMemories)) {
    for (const lm of sourceData.legacyMemories) {
      if (!lm || typeof lm.content !== 'string' || !lm.content.trim()) continue;
      const scoped = toScopedMemory(lm);
      const cleanId = ensureValidDocId(scoped.id, 'mem');
      legacyMemoriesMap.set(cleanId, {
        ...scoped,
        id: cleanId,
        scope: 'legacy',
      });
    }
  }

  // Also migrate any v1 flat `settings.memories`
  if (Array.isArray(sourceData.settings?.memories)) {
    for (const fm of sourceData.settings.memories) {
      if (!fm || typeof fm.content !== 'string' || !fm.content.trim()) continue;
      const { scope, entityId } = classifyMemoryScope(fm);
      const scoped = toScopedMemory(fm);
      const cleanId = ensureValidDocId(scoped.id, 'mem');
      if (scope === 'companion' && entityId) {
        const bucket = companionMemories[entityId] || [];
        if (!bucket.some((b) => b.id === cleanId)) {
          bucket.push({
            ...scoped,
            id: cleanId,
            scope: 'companion',
            entityId,
            modelId: entityId,
            author: 'model',
          });
        }
        companionMemories[entityId] = bucket;
      } else if (scope === 'shared') {
        if (!sharedMemoriesMap.has(cleanId)) {
          sharedMemoriesMap.set(cleanId, { ...scoped, id: cleanId, scope: 'shared', author: 'user' });
        }
      } else {
        if (!legacyMemoriesMap.has(cleanId)) {
          legacyMemoriesMap.set(cleanId, { ...scoped, id: cleanId, scope: 'legacy' });
        }
      }
    }
  }

  // Normalize gifts
  const normalizedGifts: Gift[] = [];
  if (sourceData.gifts !== undefined) {
    if (!Array.isArray(sourceData.gifts)) {
      errors.push('`gifts` must be an array.');
    } else {
      for (const rg of sourceData.gifts) {
        if (!rg || typeof rg !== 'object') continue;
        normalizedGifts.push({
          ...(rg as Gift),
          id: ensureValidDocId(rg.id, 'gift'),
          from: typeof rg.from === 'string' ? rg.from : 'Companion',
          content: typeof rg.content === 'string' ? rg.content : 'Sanctuary Keepsake',
          gift_type: typeof rg.gift_type === 'string' ? rg.gift_type : 'keepsake',
          reason: typeof rg.reason === 'string' ? rg.reason : '',
          timestamp: typeof rg.timestamp === 'number' ? rg.timestamp : Date.now(),
        });
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      schemaVersionDetected,
      checksumVerified,
      exportedAt,
      manifest: emptyManifest,
      warnings,
      errors,
    };
  }

  const normalizedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(sourceData.settings || {}),
    memories: [],
    customEntities: normalizedCompanions,
  };

  const normalizedJewel: JewelMetrics = {
    ...DEFAULT_JEWEL_METRICS,
    ...(sourceData.jewelMetrics || {}),
  };

  const normalizedProfile: UserProfile | null =
    sourceData.userProfile && typeof sourceData.userProfile === 'object'
      ? { ...sourceData.userProfile }
      : null;

  const normalizedData: SanctuaryBackupData = {
    settings: normalizedSettings,
    jewelMetrics: normalizedJewel,
    userProfile: normalizedProfile,
    conversations: normalizedConversations,
    companions: normalizedCompanions,
    companionMemories,
    sharedMemories: Array.from(sharedMemoriesMap.values()),
    legacyMemories: Array.from(legacyMemoriesMap.values()),
    gifts: normalizedGifts,
  };

  const manifest = buildBackupManifest(normalizedData);
  const envelope: SanctuaryBackupEnvelope = {
    format: BACKUP_FORMAT_ID,
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    appVersion: parsed.appVersion || APP_BACKUP_VERSION,
    exportedAt: exportedAt || new Date().toISOString(),
    exportedTimestamp:
      typeof parsed.exportedTimestamp === 'number' ? parsed.exportedTimestamp : Date.now(),
    checksum: computeBackupChecksum(normalizedData),
    manifest,
    data: normalizedData,
  };

  return {
    valid: true,
    schemaVersionDetected,
    checksumVerified: schemaVersionDetected === 1 ? true : checksumVerified || !providedChecksum,
    exportedAt: envelope.exportedAt,
    manifest,
    warnings,
    errors: [],
    envelope,
  };
}

export interface RestoreBackupOptions {
  mode: 'merge' | 'replace';
  confirmReplace?: boolean;
}

/**
 * Restores a validated backup into the active `PersistenceCoordinator`.
 * - `'merge'` (default): Non-destructively merges conversations, messages, companions, private memories,
 *   shared memories, gifts, jewel metrics, profile, and settings without deleting existing Sanctuary data.
 * - `'replace'`: Requires `confirmReplace: true`, deletes removed items cleanly via tombstones, and restores exact backup state.
 */
export async function restoreSanctuaryBackup(
  coordinator: PersistenceCoordinator,
  preview: ValidatedBackupPreview,
  options: RestoreBackupOptions = { mode: 'merge' }
): Promise<SanctuaryBackupManifest> {
  if (!preview.valid || !preview.envelope) {
    throw new Error(preview.errors[0] || 'Cannot restore an invalid backup.');
  }

  if (options.mode === 'replace' && options.confirmReplace !== true) {
    throw new Error('Explicit confirmation (`confirmReplace: true`) is required for Full Replace restoration.');
  }

  const { data } = preview.envelope;

  if (options.mode === 'replace') {
    await coordinator.clearAllDataForConfirmedReplace(true);
  }

  const currentDomain = coordinator.getDomainState();

  // 1. Settings (preserve existing stickers / favorites on merge, overwrite on replace)
  if (options.mode === 'replace') {
    await coordinator.updateSettings(data.settings);
  } else {
    const mergedStickersById = new Map<string, any>();
    for (const s of currentDomain.settings.stickers || []) {
      if (s?.id) mergedStickersById.set(s.id, s);
    }
    for (const s of data.settings.stickers || []) {
      if (s?.id && !mergedStickersById.has(s.id)) mergedStickersById.set(s.id, s);
    }

    const mergedPlacedById = new Map<string, any>();
    for (const ps of currentDomain.settings.placedStickers || []) {
      if (ps?.id) mergedPlacedById.set(ps.id, ps);
    }
    for (const ps of data.settings.placedStickers || []) {
      if (ps?.id && !mergedPlacedById.has(ps.id)) mergedPlacedById.set(ps.id, ps);
    }

    const favSet = new Set([
      ...(currentDomain.settings.favoriteModels || []),
      ...(data.settings.favoriteModels || []),
    ]);

    await coordinator.updateSettings({
      ...currentDomain.settings,
      systemInstruction:
        currentDomain.settings.systemInstruction?.trim()
          ? currentDomain.settings.systemInstruction
          : data.settings.systemInstruction,
      stickers: Array.from(mergedStickersById.values()),
      placedStickers: Array.from(mergedPlacedById.values()),
      favoriteModels: Array.from(favSet),
    });
  }

  // 2. Jewel Metrics
  if (options.mode === 'replace') {
    await coordinator.updateJewelMetrics(data.jewelMetrics);
  } else {
    await coordinator.updateJewelMetrics((prev) => ({
      totalSessions: Math.max(prev.totalSessions || 0, data.jewelMetrics.totalSessions || 0),
      totalMessages: Math.max(prev.totalMessages || 0, data.jewelMetrics.totalMessages || 0),
      totalResponseCharacters: Math.max(
        prev.totalResponseCharacters || 0,
        data.jewelMetrics.totalResponseCharacters || 0
      ),
      rapidExchanges: Math.max(prev.rapidExchanges || 0, data.jewelMetrics.rapidExchanges || 0),
      longPauses: Math.max(prev.longPauses || 0, data.jewelMetrics.longPauses || 0),
      lastInteractionTimestamp: Math.max(
        prev.lastInteractionTimestamp || 0,
        data.jewelMetrics.lastInteractionTimestamp || 0
      ),
    }));
  }

  // 3. User Profile
  if (data.userProfile) {
    if (options.mode === 'replace' || !currentDomain.userProfile) {
      await coordinator.updateProfile(data.userProfile);
    } else {
      const existingNotes = currentDomain.userProfile.gemmaNotes || [];
      const incomingNotes = data.userProfile.gemmaNotes || [];
      const notesById = new Map<string, any>();
      for (const n of [...existingNotes, ...incomingNotes]) {
        if (n?.id) notesById.set(n.id, n);
      }
      await coordinator.updateProfile({
        ...data.userProfile,
        ...currentDomain.userProfile,
        gemmaNotes: Array.from(notesById.values()),
      });
    }
  }

  // 4. Companions
  for (const [compId, compEntity] of Object.entries(data.companions || {})) {
    if (options.mode === 'replace') {
      await coordinator.upsertCompanion(compId, compEntity);
    } else {
      const existingComp = currentDomain.companions[compId];
      if (!existingComp) {
        await coordinator.upsertCompanion(compId, compEntity);
      } else {
        const diaryMap = new Map<string, any>();
        for (const d of [...(existingComp.diaryEntries || []), ...(compEntity.diaryEntries || [])]) {
          if (d?.id) diaryMap.set(d.id, d);
        }
        const propsMap = new Map<string, any>();
        for (const p of [...(existingComp.roomProps || []), ...(compEntity.roomProps || [])]) {
          if (p?.id) propsMap.set(p.id, p);
        }
        await coordinator.upsertCompanion(compId, {
          ...compEntity,
          ...existingComp,
          diaryEntries: Array.from(diaryMap.values()).sort(
            (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
          ),
          roomProps: Array.from(propsMap.values()),
        });
      }
    }
  }

  // 5. Private Companion Memories
  for (const [compId, memList] of Object.entries(data.companionMemories || {})) {
    for (const mem of memList) {
      await coordinator.upsertScopedMemory({
        ...mem,
        scope: 'companion',
        entityId: compId,
        modelId: compId,
        author: 'model',
      });
    }
  }

  // 6. Shared & Legacy Sanctuary Memories
  for (const sm of data.sharedMemories || []) {
    await coordinator.upsertScopedMemory({ ...sm, scope: 'shared', author: 'user' });
  }
  for (const lm of data.legacyMemories || []) {
    await coordinator.upsertScopedMemory({ ...lm, scope: 'legacy' });
  }

  // 7. Gifts
  for (const gift of data.gifts || []) {
    await coordinator.upsertGift(gift);
  }

  // 8. Conversations & Messages (`createOrUpsertConversationFull` merges messages by ID non-destructively)
  for (const conv of data.conversations || []) {
    await coordinator.createOrUpsertConversationFull(conv);
  }

  if (
    !coordinator.getDomainState().activeConversationId &&
    data.conversations &&
    data.conversations.length > 0
  ) {
    await coordinator.setActiveConversationId(data.conversations[0].id);
  }

  await coordinator.flushJournal();

  return preview.manifest;
}
