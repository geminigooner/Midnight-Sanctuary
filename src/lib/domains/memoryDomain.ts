import { Memory } from '../types';
import { ScopedMemory } from '../persistence/types';
import {
  canonicalCompanionId,
  getContextMemories,
  getModelMemories,
  getUserMemories,
  isUserMemory,
} from '../memorySystem';
import { cosineSimilarity } from '../vectorMemory';

export type MemoryCategory = 'fact' | 'episodic' | 'preference' | 'milestone';

export interface RankedMemoryResult {
  memory: Memory;
  score: number;
  semanticScore: number;
  recencyScore: number;
  importanceBoost: number;
}

/**
 * Normalizes memory text for fast deterministic deduplication checks.
 */
export function normalizeMemoryTextForDedup(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a candidate memory is a duplicate of an existing memory within the same scope.
 * Uses exact normalized text match or high cosine similarity (> 0.92) when embeddings exist.
 */
export function findDuplicateMemory(
  candidateText: string,
  existingMemories: (Memory | ScopedMemory)[],
  targetScope: 'shared' | 'companion',
  targetEntityId?: string,
  candidateEmbedding?: number[]
): ScopedMemory | Memory | undefined {
  const normCandidate = normalizeMemoryTextForDedup(candidateText);
  if (!normCandidate) return undefined;

  const canonicalTargetEntity = targetEntityId ? canonicalCompanionId(targetEntityId) : undefined;

  for (const mem of existingMemories || []) {
    if (!mem || (mem as ScopedMemory).isDeleted) continue;

    // Only deduplicate within the same boundary (never merge shared with companion or across companions!)
    const memIsUser = isUserMemory(mem);
    if (targetScope === 'shared' && !memIsUser) continue;
    if (targetScope === 'companion') {
      if (memIsUser) continue;
      const memEntity = canonicalCompanionId((mem as ScopedMemory).entityId || mem.modelId);
      if (canonicalTargetEntity && memEntity !== canonicalTargetEntity) continue;
    }

    const normExisting = normalizeMemoryTextForDedup(mem.content);
    if (normExisting === normCandidate) {
      return mem;
    }

    if (
      candidateEmbedding &&
      Array.isArray(mem.embedding) &&
      mem.embedding.length === candidateEmbedding.length
    ) {
      const sim = cosineSimilarity(candidateEmbedding, mem.embedding);
      if (sim >= 0.92) {
        return mem;
      }
    }
  }

  return undefined;
}

/**
 * Computes lexical overlap score (0 to 1) as a fast, zero-network fallback or hybrid signal.
 */
export function computeLexicalSimilarity(queryText: string, memoryText: string): number {
  const qTokens = new Set(
    normalizeMemoryTextForDedup(queryText)
      .split(' ')
      .filter((w) => w.length >= 3)
  );
  if (qTokens.size === 0) return 0;

  const mTokens = normalizeMemoryTextForDedup(memoryText)
    .split(' ')
    .filter((w) => w.length >= 3);
  if (mTokens.length === 0) return 0;

  let matches = 0;
  for (const token of mTokens) {
    if (qTokens.has(token)) matches++;
  }
  return Math.min(1, matches / Math.max(1, Math.min(qTokens.size, 6)));
}

/**
 * Ranks isolated context memories (`shared` + `respondingEntityId` private) in O(N) pure math
 * using pre-persisted memory embeddings (if available), lexical overlap, recency decay,
 * and locked/episodic importance boosts.
 *
 * Strictly enforces sovereign entity memory boundaries via `getContextMemories(memories, respondingEntityId)`.
 */
export function rankSovereignMemories(
  allCandidateMemories: Memory[],
  respondingEntityId: string,
  options?: {
    queryText?: string;
    queryEmbedding?: number[] | null;
    maxTotal?: number;
  }
): Memory[] {
  const isolatedPool = getContextMemories(allCandidateMemories, respondingEntityId);
  const maxTotal = options?.maxTotal ?? 20;

  if (isolatedPool.length <= maxTotal) {
    return isolatedPool;
  }

  const lockedMemories = isolatedPool.filter((m) => m.isLocked);
  const unlockedMemories = isolatedPool.filter((m) => !m.isLocked);

  const queryText = options?.queryText?.trim() || '';
  const queryEmbedding = options?.queryEmbedding || null;
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const scored: RankedMemoryResult[] = unlockedMemories.map((memory) => {
    const lexical = queryText ? computeLexicalSimilarity(queryText, memory.content || '') : 0;
    let semantic = lexical;

    if (
      queryEmbedding &&
      Array.isArray(memory.embedding) &&
      memory.embedding.length === queryEmbedding.length
    ) {
      const cosine = Math.max(0, cosineSimilarity(queryEmbedding, memory.embedding));
      semantic = Math.max(cosine, lexical * 0.85);
    }

    const ageMs = Math.max(0, now - (memory.createdAt || now));
    const recencyScore = Math.exp(-ageMs / THIRTY_DAYS_MS);

    const importanceBoost =
      memory.memoryType === 'episodic' || memory.memoryType === 'milestone'
        ? 1.0
        : memory.origin === 'user_favorited' || memory.origin === 'chat_starred'
        ? 0.85
        : 0.5;

    const score = semantic * 0.65 + recencyScore * 0.2 + importanceBoost * 0.15;

    return {
      memory,
      score,
      semanticScore: semantic,
      recencyScore,
      importanceBoost,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const remainingSlots = Math.max(5, maxTotal - lockedMemories.length);
  const selectedUnlocked = scored.slice(0, remainingSlots).map((s) => s.memory);

  return [...lockedMemories, ...selectedUnlocked];
}

/**
 * Counts total active Sanctuary memories across isolated `sharedMemories` and `companionMemories`
 * (falling back to `settings.memories` only when isolated maps are not passed).
 */
export function countTotalSanctuaryMemories(params: {
  sharedMemories?: ScopedMemory[];
  companionMemories?: Record<string, ScopedMemory[]>;
  legacySettingsMemories?: Memory[];
}): number {
  const seenIds = new Set<string>();

  for (const sm of params.sharedMemories || []) {
    if (sm && sm.id && !sm.isDeleted) seenIds.add(sm.id);
  }
  for (const list of Object.values(params.companionMemories || {})) {
    for (const cm of list || []) {
      if (cm && cm.id && !cm.isDeleted) seenIds.add(cm.id);
    }
  }
  if (seenIds.size === 0 && Array.isArray(params.legacySettingsMemories)) {
    for (const lm of params.legacySettingsMemories) {
      if (lm && lm.id && !(lm as ScopedMemory).isDeleted) seenIds.add(lm.id);
    }
  }

  return seenIds.size;
}

export { getUserMemories, getModelMemories, getContextMemories };
