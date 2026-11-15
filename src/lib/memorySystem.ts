import { Memory } from './types';
import { resolveModelIdentity, normalizeModelId } from './modelSystem';
import { MemoryScope, ScopedMemory } from './persistence/types';

export function normalizeMemoryNamespace(modelId?: string): string {
  if (!modelId) return 'unknown';
  const def = resolveModelIdentity(modelId);
  if (def) {
    return def.namespaces.memory || def.identityId;
  }
  return normalizeModelId(modelId) || 'unknown';
}

export function canonicalCompanionId(modelId?: string): string {
  if (!modelId) return 'unknown';
  const def = resolveModelIdentity(modelId);
  if (def?.identityId) {
    return def.identityId;
  }
  const normalized = normalizeModelId(modelId);
  return (normalized || modelId).replace(/^models\//, '').trim() || 'unknown';
}

// Core Classification
export function isUserMemory(m: Memory): boolean {
  if ((m as ScopedMemory).scope === 'shared') return true;
  if ((m as ScopedMemory).scope === 'companion' || (m as ScopedMemory).scope === 'legacy') {
    return false;
  }
  if (m.author === 'model' || m.origin === 'model_initiated' || m.origin === 'model_locked' || m.origin === 'gemma_initiated') {
    return false;
  }
  return (
    m.author === 'user' ||
    m.origin === 'user_favorited' ||
    m.origin === 'user_saved' ||
    m.origin === 'user_settings' ||
    m.origin === 'direct_input' ||
    m.origin === 'chat_starred'
  );
}

export function isExplicitModelMemory(m: Memory): boolean {
  if ((m as ScopedMemory).scope === 'companion') return true;
  if ((m as ScopedMemory).scope === 'shared' || (m as ScopedMemory).scope === 'legacy') {
    return false;
  }
  return (
    m.author === 'model' ||
    m.origin === 'gemma_initiated' ||
    m.origin === 'model_initiated' ||
    m.origin === 'model_locked'
  );
}

export function classifyMemoryScope(m: Memory): { scope: MemoryScope; entityId?: string } {
  const existingScope = (m as ScopedMemory).scope;
  const existingEntity = (m as ScopedMemory).entityId;
  if (existingScope === 'companion' && (existingEntity || m.modelId)) {
    const cid = canonicalCompanionId(existingEntity || m.modelId);
    if (cid !== 'unknown') {
      return { scope: 'companion', entityId: cid };
    }
  }
  if (existingScope === 'shared') {
    return { scope: 'shared' };
  }
  if (existingScope === 'legacy') {
    return { scope: 'legacy' };
  }

  if (isUserMemory(m)) {
    return { scope: 'shared' };
  }

  if (isExplicitModelMemory(m) && m.modelId) {
    const cid = canonicalCompanionId(m.modelId);
    if (cid !== 'unknown') {
      return { scope: 'companion', entityId: cid };
    }
  }

  return { scope: 'legacy' };
}

export function toScopedMemory(raw: Memory, defaultRevision = Date.now()): ScopedMemory {
  const { scope, entityId } = classifyMemoryScope(raw);
  const createdAt =
    typeof raw.createdAt === 'number' && !Number.isNaN(raw.createdAt) ? raw.createdAt : Date.now();
  return {
    ...raw,
    id: raw.id || `mem-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    author: scope === 'shared' ? 'user' : scope === 'companion' ? 'model' : raw.author,
    modelId: entityId || (raw.modelId ? canonicalCompanionId(raw.modelId) : undefined),
    scope,
    entityId,
    revision: (raw as ScopedMemory).revision ?? defaultRevision,
    updatedAt: (raw as ScopedMemory).updatedAt ?? createdAt,
  };
}

// Selectors
export function getUserMemories(memories: Memory[]): Memory[] {
  return (memories || []).filter(isUserMemory);
}

export function getModelMemories(memories: Memory[], modelId: string): Memory[] {
  const currentNamespace = normalizeMemoryNamespace(modelId);
  return (memories || []).filter((m) => {
    if (!isExplicitModelMemory(m)) return false;
    const targetModel = (m as ScopedMemory).entityId || m.modelId;
    return normalizeMemoryNamespace(targetModel) === currentNamespace;
  });
}

export function getLegacyMemories(memories: Memory[], currentModelId: string): Memory[] {
  const currentNamespace = normalizeMemoryNamespace(currentModelId);
  return (memories || []).filter((m) => {
    if (isUserMemory(m)) return false;
    const targetModel = (m as ScopedMemory).entityId || m.modelId;
    if (isExplicitModelMemory(m) && normalizeMemoryNamespace(targetModel) === currentNamespace) {
      return false;
    }
    if ((m as ScopedMemory).scope === 'companion' && targetModel) {
      return false; // Private to another companion — never expose as legacy shared!
    }
    return !targetModel || (m as ScopedMemory).scope === 'legacy';
  });
}

/**
 * Strictly constructs active prompt memories for `modelId`:
 * Shared User Memories + ONLY `modelId`'s Private Companion Memories.
 * Never leaks another companion's private memories, even in multi-entity group threads.
 */
export function getContextMemories(memories: Memory[], modelId: string): Memory[] {
  const deduped = new Map<string, Memory>();
  for (const m of [...getUserMemories(memories), ...getModelMemories(memories, modelId)]) {
    if (m && m.id && !(m as ScopedMemory).isDeleted) {
      deduped.set(m.id, m);
    }
  }
  return Array.from(deduped.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Combines isolated shared/legacy memories and per-companion memory maps into a unified
 * view array for backwards-compatible UI archives while preserving each item's `scope` and `entityId`.
 */
export function combineIsolatedMemories(
  sharedMemories: ScopedMemory[],
  companionMemoriesByEntity: Record<string, ScopedMemory[]>
): ScopedMemory[] {
  const byId = new Map<string, ScopedMemory>();

  for (const sm of sharedMemories || []) {
    if (!sm || sm.isDeleted) continue;
    byId.set(sm.id, sm);
  }

  for (const [entityId, list] of Object.entries(companionMemoriesByEntity || {})) {
    for (const cm of list || []) {
      if (!cm || cm.isDeleted) continue;
      byId.set(cm.id, {
        ...cm,
        scope: 'companion',
        entityId: cm.entityId || entityId,
        modelId: cm.modelId || entityId,
        author: 'model',
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
