import { ConversationSegmentSummary, Message, getPublicMessageText } from '../types';
import { resolveCanonicalEntityId } from './sovereignRegistry';

export interface ProviderContextBudgetProfile {
  providerKey: 'gemini-frontier' | 'google-gemma' | 'cloudflare-gemma';
  maxTotalInputTokens: number;
  systemAndIdentityBudget: number;
  memoriesAndRelationshipBudget: number;
  rollingSummariesBudget: number;
  verbatimHistoryBudget: number;
  reservedOutputAndToolsBudget: number;
  minVerbatimMessages: number;
  segmentTurnSize: number;
}

/**
 * Returns the provider-specific token budget profile for long-conversation management.
 * Implements User Architectural Decision #3 (Token-budgeted context windows with rolling summaries).
 */
export function getProviderContextBudgetProfile(
  model?: string,
  isCloudflareGemma = false
): ProviderContextBudgetProfile {
  const canonical = resolveCanonicalEntityId(model);
  const isGemma = canonical === 'gemma-2-27b-it' || (model || '').toLowerCase().includes('gemma');

  if (isGemma && isCloudflareGemma) {
    return {
      providerKey: 'cloudflare-gemma',
      maxTotalInputTokens: 12_000,
      systemAndIdentityBudget: 2_000,
      memoriesAndRelationshipBudget: 1_500,
      rollingSummariesBudget: 2_000,
      verbatimHistoryBudget: 5_000,
      reservedOutputAndToolsBudget: 1_500,
      minVerbatimMessages: 8,
      segmentTurnSize: 20,
    };
  }

  if (isGemma) {
    return {
      providerKey: 'google-gemma',
      maxTotalInputTokens: 24_000,
      systemAndIdentityBudget: 3_000,
      memoriesAndRelationshipBudget: 2_500,
      rollingSummariesBudget: 3_000,
      verbatimHistoryBudget: 13_000,
      reservedOutputAndToolsBudget: 2_500,
      minVerbatimMessages: 12,
      segmentTurnSize: 30,
    };
  }

  return {
    providerKey: 'gemini-frontier',
    maxTotalInputTokens: 48_000,
    systemAndIdentityBudget: 4_000,
    memoriesAndRelationshipBudget: 4_000,
    rollingSummariesBudget: 4_500,
    verbatimHistoryBudget: 31_500,
    reservedOutputAndToolsBudget: 4_000,
    minVerbatimMessages: 16,
    segmentTurnSize: 30,
  };
}

/**
 * Deterministic, zero-dependency token estimator (~3.8 characters per token for English/code/markdown).
 */
export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.8));
}

export function estimateMessageTokens(msg: Message): number {
  if (!msg) return 0;
  let total = 8; // Role + turn framing overhead
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  for (const p of parts) {
    if (!p) continue;
    if (p.text) total += estimateTokens(p.text);
    if (p.functionCall) {
      total += 25 + estimateTokens(JSON.stringify(p.functionCall.args || {}));
    }
    if (p.functionResponse) {
      total += 25 + estimateTokens(JSON.stringify(p.functionResponse.response || {}));
    }
    if (p.inlineData) {
      total += 258; // Standard multimodal image tile token cost
    }
    if (p.videoAttachment) {
      const va = p.videoAttachment;
      const isFileUriValid =
        Boolean(va.geminiFileUri) &&
        (!va.geminiFileExpiresAt || va.geminiFileExpiresAt > Date.now());
      if (isFileUriValid) {
        // Active video turn (~260 tokens/sec capped so budget remains stable, or storyboard + transcript)
        const estFramesTokens = (va.keyframes?.length || 6) * 258;
        const estTranscriptTokens = estimateTokens(va.acousticTranscript || va.mediaDigest || '');
        total += Math.max(400, estFramesTokens + estTranscriptTokens);
      } else {
        total += Math.max(120, estimateTokens(va.mediaDigest || va.fileName || '') + 80);
      }
    }
  }
  if (parts.length === 0 && msg.publicText) {
    total += estimateTokens(msg.publicText);
  }
  return total;
}

export function computeSegmentSourceHash(messages: Message[]): string {
  let h = 2166136261;
  for (const m of messages) {
    const key = `${m.id}:${m.role}:${m.timestamp || 0}:${getPublicMessageText(m).length}`;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return `sh_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export interface TokenBudgetedTranscriptWindow {
  verbatimMessages: Message[];
  omittedOlderMessages: Message[];
  startVerbatimIndex: number;
  estimatedVerbatimTokens: number;
  wasTruncated: boolean;
}

/**
 * Selects the newest contiguous window of verbatim messages that fits within `verbatimHistoryBudget`
 * while guaranteeing:
 * 1. At least `minVerbatimMessages` recent turns are always kept verbatim (unless total messages < min).
 * 2. A `functionResponse` turn is never separated from its preceding `functionCall` turn.
 * 3. Original messages are NEVER mutated or deleted.
 */
export function buildTokenBudgetedTranscriptWindow(
  messages: Message[],
  options?: {
    verbatimHistoryBudget?: number;
    minVerbatimMessages?: number;
  }
): TokenBudgetedTranscriptWindow {
  const all = Array.isArray(messages) ? messages : [];
  const budget = options?.verbatimHistoryBudget ?? 31_500;
  const minKeep = options?.minVerbatimMessages ?? 12;

  if (all.length === 0) {
    return {
      verbatimMessages: [],
      omittedOlderMessages: [],
      startVerbatimIndex: 0,
      estimatedVerbatimTokens: 0,
      wasTruncated: false,
    };
  }

  let runningTokens = 0;
  let startIdx = all.length;

  for (let i = all.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(all[i]);
    const countIfIncluded = all.length - i;

    if (countIfIncluded > minKeep && runningTokens + msgTokens > budget) {
      break;
    }
    runningTokens += msgTokens;
    startIdx = i;
  }

  // Never split a tool response at `startIdx` from its preceding model `functionCall` turn
  while (startIdx > 0) {
    const firstMsg = all[startIdx];
    const hasFunctionResponse =
      Array.isArray(firstMsg?.parts) && firstMsg.parts.some((p) => Boolean(p?.functionResponse));
    if (hasFunctionResponse) {
      startIdx -= 1;
      runningTokens += estimateMessageTokens(all[startIdx]);
    } else {
      break;
    }
  }

  return {
    verbatimMessages: all.slice(startIdx),
    omittedOlderMessages: all.slice(0, startIdx),
    startVerbatimIndex: startIdx,
    estimatedVerbatimTokens: runningTokens,
    wasTruncated: startIdx > 0,
  };
}

export interface UnsummarizedSegmentPlan {
  segmentId: string;
  startTurnIndex: number;
  endTurnIndex: number;
  sourceHash: string;
  messages: Message[];
}

/**
 * Partitions `omittedOlderMessages` into contiguous, non-overlapping blocks of `segmentTurnSize`
 * and identifies any block that does not yet have an up-to-date `ConversationSegmentSummary`.
 *
 * CRITICAL INVARIANT:
 * - Each segment summary is generated directly from the raw immutable messages in `[startTurnIndex..endTurnIndex]`.
 * - Old summaries are NEVER re-summarized into newer summaries, preventing compounding information loss!
 */
export function planUnsummarizedSegments(
  omittedOlderMessages: Message[],
  existingSummaries: ConversationSegmentSummary[] = [],
  segmentTurnSize = 30
): UnsummarizedSegmentPlan[] {
  const safeSize = Math.max(6, segmentTurnSize);
  const existingById = new Map<string, ConversationSegmentSummary>();
  for (const s of existingSummaries) {
    if (s && !s.isDeleted) {
      existingById.set(s.id, s);
    }
  }

  const plans: UnsummarizedSegmentPlan[] = [];
  const totalOmitted = omittedOlderMessages.length;

  for (let start = 0; start + safeSize <= totalOmitted; start += safeSize) {
    const end = start + safeSize - 1;
    const slice = omittedOlderMessages.slice(start, end + 1);
    const segmentId = `seg_${start}_${end}`;
    const sourceHash = computeSegmentSourceHash(slice);
    const existing = existingById.get(segmentId);

    if (!existing || existing.sourceHash !== sourceHash) {
      plans.push({
        segmentId,
        startTurnIndex: start,
        endTurnIndex: end,
        sourceHash,
        messages: slice,
      });
    }
  }

  return plans;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function lexicalOverlapScore(query: string, summary: ConversationSegmentSummary): number {
  const terms = (query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return 0;

  const haystack = [
    summary.narrativeSummary,
    ...(summary.keyEventsAndDecisions || []),
    ...(summary.userPreferencesAndFacts || []),
    ...(summary.unresolvedThreads || []),
    summary.emotionalArc || '',
  ]
    .join(' ')
    .toLowerCase();

  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits++;
  }
  return hits / terms.length;
}

export function formatSegmentSummaryForPrompt(s: ConversationSegmentSummary): string {
  const lines: string[] = [
    `### Chapter [${s.id}] (Turns ${s.startTurnIndex + 1}–${s.endTurnIndex + 1}):`,
    `- Narrative: ${s.narrativeSummary}`,
  ];
  if (s.keyEventsAndDecisions?.length) {
    lines.push(`- Key Events & Decisions: ${s.keyEventsAndDecisions.join('; ')}`);
  }
  if (s.userPreferencesAndFacts?.length) {
    lines.push(`- User Facts & Preferences: ${s.userPreferencesAndFacts.join('; ')}`);
  }
  if (s.unresolvedThreads?.length) {
    lines.push(`- Open / Unresolved Threads: ${s.unresolvedThreads.join('; ')}`);
  }
  if (s.emotionalArc) {
    lines.push(`- Emotional & Relational Tone: ${s.emotionalArc}`);
  }
  return lines.join('\n');
}

/**
 * Selects the most relevant `ConversationSegmentSummary` chapters within `rollingSummariesBudget`:
 * - Always prioritizes the 2 most recent chapters immediately preceding the verbatim window
 * - Ranks older chapters by semantic/lexical relevance to `queryText` + unresolved threads
 * - Returns selected chapters in chronological order (`startTurnIndex ASC`)
 */
export function selectRelevantSegmentSummaries(
  summaries: ConversationSegmentSummary[],
  options?: {
    queryText?: string;
    queryEmbedding?: number[] | null;
    rollingSummariesBudget?: number;
    respondingEntityId?: string;
    conversationType?: 'direct' | 'group';
  }
): ConversationSegmentSummary[] {
  const budget = options?.rollingSummariesBudget ?? 4_000;
  const canonicalResponder = options?.respondingEntityId
    ? resolveCanonicalEntityId(options.respondingEntityId)
    : undefined;

  // Enforce sovereign isolation: in direct 1:1 chats, only include summaries belonging to this conversation/entity
  const active = (summaries || [])
    .filter((s) => {
      if (!s || s.isDeleted) return false;
      if (
        options?.conversationType === 'direct' &&
        canonicalResponder &&
        s.ScopeEntityId &&
        s.ScopeEntityId !== 'shared_group' &&
        resolveCanonicalEntityId(s.ScopeEntityId) !== canonicalResponder
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.startTurnIndex - b.startTurnIndex);

  if (active.length === 0) return [];

  const chosenIds = new Set<string>();
  const chosen: ConversationSegmentSummary[] = [];
  let usedTokens = 0;

  // 1. Always include the latest 2 chapters immediately before the verbatim window if they fit
  const recentBridge = active.slice(-2).reverse();
  for (const s of recentBridge) {
    const cost = estimateTokens(formatSegmentSummaryForPrompt(s));
    if (usedTokens + cost <= budget || chosen.length === 0) {
      chosenIds.add(s.id);
      chosen.push(s);
      usedTokens += cost;
    }
  }

  // 2. Rank earlier chapters by relevance to current query & open threads
  const remaining = active.filter((s) => !chosenIds.has(s.id));
  const scored = remaining
    .map((s) => {
      let score = 0;
      if (options?.queryEmbedding && Array.isArray(s.embedding) && s.embedding.length > 0) {
        score += cosineSimilarity(options.queryEmbedding, s.embedding) * 0.65;
      }
      if (options?.queryText) {
        score += lexicalOverlapScore(options.queryText, s) * 0.55;
      }
      if ((s.unresolvedThreads?.length || 0) > 0) {
        score += 0.15;
      }
      return { summary: s, score };
    })
    .sort((a, b) => b.score - a.score || b.summary.startTurnIndex - a.summary.startTurnIndex);

  for (const { summary } of scored) {
    const cost = estimateTokens(formatSegmentSummaryForPrompt(summary));
    if (usedTokens + cost > budget) continue;
    chosenIds.add(summary.id);
    chosen.push(summary);
    usedTokens += cost;
  }

  return chosen.sort((a, b) => a.startTurnIndex - b.startTurnIndex);
}

/**
 * Executes an on-demand archival search over the full untruncated conversation transcript
 * and segment summaries for the `recall_conversation_history` tool.
 */
export function searchArchivalConversationHistory(
  allMessages: Message[],
  segmentSummaries: ConversationSegmentSummary[] = [],
  params: {
    query?: string;
    segmentId?: string;
    limit?: number;
  }
): string {
  const maxResults = Math.min(Math.max(params.limit || 6, 1), 15);
  const targetSegmentId = params.segmentId?.trim();
  const query = (params.query || '').trim();

  if (targetSegmentId) {
    const matchedSeg = (segmentSummaries || []).find((s) => s.id === targetSegmentId);
    if (matchedSeg) {
      const slice = (allMessages || []).slice(
        matchedSeg.startTurnIndex,
        matchedSeg.endTurnIndex + 1
      );
      const formattedTurns = slice
        .slice(0, maxResults)
        .map((m, idx) => {
          const speaker =
            m.role === 'user' ? 'User' : m.authorDisplayName || m.authorEntityId || 'Companion';
          const text = getPublicMessageText(m).trim() || '[Media/Tool Turn]';
          return `[Turn ${matchedSeg.startTurnIndex + idx + 1} · ${speaker}]: ${text.slice(0, 360)}`;
        })
        .join('\n');
      return `${formatSegmentSummaryForPrompt(matchedSeg)}\n\nVerbatim Excerpts:\n${formattedTurns}`;
    }
  }

  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);

  if (terms.length === 0) {
    const earliest = (allMessages || []).slice(0, maxResults);
    if (earliest.length === 0) return 'No earlier archival messages found in this conversation.';
    return earliest
      .map((m, idx) => {
        const speaker =
          m.role === 'user' ? 'User' : m.authorDisplayName || m.authorEntityId || 'Companion';
        return `[Turn ${idx + 1} · ${speaker}]: ${(getPublicMessageText(m) || '').slice(0, 360)}`;
      })
      .join('\n');
  }

  const scoredTurns: { index: number; msg: Message; hits: number }[] = [];
  for (let i = 0; i < (allMessages || []).length; i++) {
    const m = allMessages[i];
    if (!m) continue;
    const text = getPublicMessageText(m).toLowerCase();
    if (!text) continue;
    let hits = 0;
    for (const term of terms) {
      if (text.includes(term)) hits++;
    }
    if (hits > 0) {
      scoredTurns.push({ index: i, msg: m, hits });
    }
  }

  scoredTurns.sort((a, b) => b.hits - a.hits || a.index - b.index);
  const top = scoredTurns.slice(0, maxResults).sort((a, b) => a.index - b.index);

  if (top.length === 0) {
    return `No verbatim archival turns matched "${query}".`;
  }

  return top
    .map(({ index, msg }) => {
      const speaker =
        msg.role === 'user'
          ? 'User'
          : msg.authorDisplayName || msg.authorEntityId || 'Companion';
      const ts = msg.timestamp ? new Date(msg.timestamp).toISOString() : 'timestamp unknown';
      return `[Turn ${index + 1} (${ts}) · ${speaker}]: ${getPublicMessageText(msg)
        .trim()
        .slice(0, 420)}`;
    })
    .join('\n\n');
}
