import { GoogleGenAI } from '@google/genai';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { Memory } from './types';

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
 * Request text embedding from backend / Google GenAI
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  const cached = memoryEmbeddingCache.get(text.trim());
  if (cached) return cached;

  try {
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.embedding && Array.isArray(data.embedding)) {
      memoryEmbeddingCache.set(text.trim(), data.embedding);
      return data.embedding;
    }
  } catch (err) {
    console.warn('[VectorMemory] Embedding generation failed:', err);
  }
  return null;
}

/**
 * Score and retrieve top semantic memories for any given query or user message
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
    return allMemories.slice(0, topK).map(m => ({ memory: m, similarity: 1.0 }));
  }

  const scored: { memory: Memory; similarity: number }[] = [];

  for (const memory of allMemories) {
    if (!memory.content || !memory.content.trim()) continue;
    const memEmbedding = await getEmbedding(memory.content);
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
