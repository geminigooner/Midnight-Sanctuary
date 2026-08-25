import { Memory } from './types';

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
  return memories.filter(m => isExplicitModelMemory(m) && m.modelId === modelId);
}

export function getLegacyMemories(memories: Memory[], currentModelId: string): Memory[] {
  return memories.filter(m => {
    if (isUserMemory(m)) return false;
    if (isExplicitModelMemory(m) && m.modelId === currentModelId) return false;
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
