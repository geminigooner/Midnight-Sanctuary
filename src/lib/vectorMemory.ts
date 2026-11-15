import { Memory } from './types';
import { auth } from './firebase';

// Mathematical Cosine Similarity calculation
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface VectorMemoryRecord {
  id: string;
  content: string;
  embedding: number[];
  author?: 'user' | 'model';
  modelId?: string;
  timestamp: number;
  similarity?: number;
}

// Client-side cache for embeddings to avoid re-computing existing memories
const memoryEmbeddingCache = new Map<string, number[]>();

/**
 * Request text embedding from authenticated backend `/api/embed` route.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();
  const cached = memoryEmbeddingCache.get(trimmed);
  if (cached) return cached;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/embed', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.embedding && Array.isArray(data.embedding)) {
      memoryEmbeddingCache.set(trimmed, data.embedding);
      return data.embedding;
    }
  } catch (err) {
    console.warn('[VectorMemory] Embedding generation failed:', err);
  }
  return null;
}

/**
 * Score and retrieve top semantic memories for any given query or user message,
 * utilizing pre-computed `memory.embedding` vectors when available.
 */
export async function retrieveRelevantMemories(
  queryText: string,
  allMemories: Memory[],
  topK: number = 6
): Promise<{ memory: Memory; similarity: number }[]> {
  if (!queryText.trim() || !allMemories || allMemories.length === 0) {
    return [];
  }

  const queryEmbedding = await getEmbedding(queryText);
  if (!queryEmbedding) {
    return allMemories.slice(0, topK).map((m) => ({ memory: m, similarity: 1.0 }));
  }

  const scored: { memory: Memory; similarity: number }[] = [];

  for (const memory of allMemories) {
    if (!memory.content || !memory.content.trim()) continue;
    const memEmbedding =
      Array.isArray(memory.embedding) && memory.embedding.length > 0
        ? memory.embedding
        : await getEmbedding(memory.content);
    if (memEmbedding) {
      const similarity = cosineSimilarity(queryEmbedding, memEmbedding);
      scored.push({ memory, similarity });
    } else {
      scored.push({ memory, similarity: 0.1 });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
