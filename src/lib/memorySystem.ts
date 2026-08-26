import { Memory } from './types';
import { resolveModelIdentity, normalizeModelId } from './modelSystem';

export function normalizeMemoryNamespace(modelId?: string): string {
  if (!modelId) return 'unknown';
  const def = resolveModelIdentity(modelId);
  if (def) {
    return def.namespaces.memory || def.identityId;
  }
  return normalizeModelId(modelId) || 'unknown';
}

// Core Classification
export function isUserMemory(m: Memory): boolean {
  return m.author === 'user' || m.origin === 'user_favorited' || m.origin === 'user_saved';
}

export function isExplicitModelMemory(m: Memory): boolean {
  return m.author === 'model' || m.origin === 'gemma_initiated';
}

// Selectors
export function getUserMemories(memories: Memory[]): Memory[] {
  return memories.filter(isUserMemory);
}

export function getModelMemories(memories: Memory[], modelId: string): Memory[] {
  const currentNamespace = normalizeMemoryNamespace(modelId);
  return memories.filter(m => isExplicitModelMemory(m) && normalizeMemoryNamespace(m.modelId) === currentNamespace);
}

export function getLegacyMemories(memories: Memory[], currentModelId: string): Memory[] {
  const currentNamespace = normalizeMemoryNamespace(currentModelId);
  return memories.filter(m => {
    if (isUserMemory(m)) return false;
    if (isExplicitModelMemory(m) && normalizeMemoryNamespace(m.modelId) === currentNamespace) return false;
    return true; // Unassigned, legacy, or belongs to another model
  });
}

export function getContextMemories(memories: Memory[], modelId: string): Memory[] {
  // Context strictly gets User Memories + EXACTLY this model's memories
  // Legacy/ambiguous memories are excluded from active context 
  // as per: "ambiguous/legacy memories are preserved but excluded from model context for now"
  return [
    ...getUserMemories(memories),
    ...getModelMemories(memories, modelId)
  ];
}

