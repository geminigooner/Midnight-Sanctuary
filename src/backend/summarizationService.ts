import { GoogleGenAI, Type } from '@google/genai';
import {
  UnsummarizedSegmentPlan,
  estimateMessageTokens,
} from '../lib/domains/contextWindowEngine';
import { resolveCanonicalEntityId } from '../lib/domains/sovereignRegistry';
import { ConversationSegmentSummary, Message, getPublicMessageText } from '../lib/types';
import { generateEmbedding, resolveAvailableApiKeys } from './harness/modelExecutionHarness';

/**
 * Structured Rolling Segment Summarization Service.
 *
 * Implements User Architectural Decision #3:
 * - Summarizes immutable contiguous 30-turn blocks of older messages that have aged out of the
 *   verbatim active context window.
 * - Preserves:
 *   1. `narrativeSummary` (2-3 sentences of what transpired)
 *   2. `keyEventsAndDecisions` (concrete milestones, promises, decisions, gifts)
 *   3. `userPreferencesAndFacts` (facts, boundaries, or preferences shared by the user)
 *   4. `unresolvedThreads` (open questions, plans, or ongoing topics)
 *   5. `emotionalArc` (relational and emotional tone of the chapter)
 * - Never re-summarizes old summaries (zero compounding drift) and never deletes raw messages.
 * - Includes a deterministic local extractor fallback when API keys/quotas are unavailable.
 */
export function buildDeterministicSegmentSummary(params: {
  conversationId: string;
  ScopeEntityId: string;
  plan: UnsummarizedSegmentPlan;
}): ConversationSegmentSummary {
  const { conversationId, ScopeEntityId, plan } = params;
  const msgs = plan.messages || [];

  const userSnippets: string[] = [];
  const modelSnippets: string[] = [];
  const keyEventsAndDecisions: string[] = [];
  const userPreferencesAndFacts: string[] = [];
  const unresolvedThreads: string[] = [];

  for (const m of msgs) {
    const text = getPublicMessageText(m).trim();
    if (!text) continue;
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) || text.slice(0, 140);

    if (m.role === 'user') {
      if (userSnippets.length < 3) userSnippets.push(firstSentence);
      if (/\b(i love|i prefer|my favorite|i work|my name|please remember|always|never)\b/i.test(text)) {
        if (userPreferencesAndFacts.length < 4) {
          userPreferencesAndFacts.push(firstSentence);
        }
      }
      if (text.includes('?') && unresolvedThreads.length < 3) {
        unresolvedThreads.push(firstSentence);
      }
    } else {
      if (modelSnippets.length < 3) modelSnippets.push(firstSentence);
    }

    const hasTool = Array.isArray(m.parts) && m.parts.some((p) => Boolean(p?.functionCall));
    if (hasTool && keyEventsAndDecisions.length < 4) {
      const toolNames = (m.parts || [])
        .filter((p) => p?.functionCall?.name)
        .map((p) => p.functionCall!.name)
        .join(', ');
      if (toolNames) {
        keyEventsAndDecisions.push(`Companion invoked Sanctuary tools (${toolNames}).`);
      }
    }
  }

  const narrativeSummary = [
    userSnippets.length > 0
      ? `User discussed: "${userSnippets.slice(0, 2).join(' | ')}".`
      : 'User and companion shared an exchange.',
    modelSnippets.length > 0
      ? `Companion responded with reflections on "${modelSnippets.slice(0, 2).join(' | ')}".`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tokenCountOriginal = msgs.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const firstMsg = msgs[0];
  const lastMsg = msgs[msgs.length - 1];

  return {
    id: plan.segmentId,
    conversationId,
    ScopeEntityId,
    entityId: ScopeEntityId,
    scope: ScopeEntityId === 'shared_group' ? 'group' : 'direct',
    segmentIndex: Math.max(0, Math.floor(plan.startTurnIndex / 30)),
    startTurnIndex: plan.startTurnIndex,
    endTurnIndex: plan.endTurnIndex,
    startMessageId: firstMsg?.id || `turn_${plan.startTurnIndex}`,
    endMessageId: lastMsg?.id || `turn_${plan.endTurnIndex}`,
    startTimestamp: firstMsg?.timestamp || Date.now(),
    endTimestamp: lastMsg?.timestamp || Date.now(),
    messageCount: msgs.length,
    tokenCountOriginal,
    narrativeSummary,
    keyEventsAndDecisions,
    userPreferencesAndFacts,
    unresolvedThreads,
    emotionalArc: 'Attentive, reflective Sanctuary continuity',
    sourceHash: plan.sourceHash,
    createdAt: Date.now(),
    revision: Date.now(),
  } as ConversationSegmentSummary;
}

export async function summarizeConversationSegment(params: {
  conversationId: string;
  respondingEntityId: string;
  conversationType?: 'direct' | 'group';
  plan: UnsummarizedSegmentPlan;
}): Promise<ConversationSegmentSummary> {
  const { conversationId, respondingEntityId, conversationType, plan } = params;
  const canonicalEntity =
    conversationType === 'group'
      ? 'shared_group'
      : resolveCanonicalEntityId(respondingEntityId) || 'gemini-3.1-pro-preview';

  const fallbackSummary = buildDeterministicSegmentSummary({
    conversationId,
    ScopeEntityId: canonicalEntity,
    plan,
  });

  const { availableKeys } = resolveAvailableApiKeys('models/gemini-3-flash-preview');
  if (availableKeys.length === 0) {
    return fallbackSummary;
  }

  const transcriptLines = plan.messages
    .map((m: Message, idx: number) => {
      const speaker =
        m.role === 'user' ? 'User' : m.authorDisplayName || m.authorEntityId || 'Companion';
      const text = getPublicMessageText(m).trim().slice(0, 500);
      return `[Turn ${plan.startTurnIndex + idx + 1} · ${speaker}]: ${text}`;
    })
    .join('\n');

  const prompt = `Summarize the following contiguous chapter of a Midnight Sanctuary conversation (Turns ${
    plan.startTurnIndex + 1
  } to ${
    plan.endTurnIndex + 1
  }) into structured continuity fields so the companion retains long-term relational memory without losing important facts, promises, or unresolved threads.\n\nTranscript:\n${transcriptLines}`;

  for (const apiKey of availableKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'models/gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              narrativeSummary: {
                type: Type.STRING,
                description: 'Concise 2-3 sentence summary of what transpired in this chapter.',
              },
              keyEventsAndDecisions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Concrete events, decisions, gifts, or milestones from this segment.',
              },
              userPreferencesAndFacts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Facts, preferences, or boundaries shared by the user.',
              },
              unresolvedThreads: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Open questions, promised follow-ups, or ongoing topics.',
              },
              emotionalArc: {
                type: Type.STRING,
                description: 'Brief description of the emotional and relational tone.',
              },
            },
            required: [
              'narrativeSummary',
              'keyEventsAndDecisions',
              'userPreferencesAndFacts',
              'unresolvedThreads',
              'emotionalArc',
            ],
          },
        },
      });

      const parsed = JSON.parse(res.text || '{}');
      if (parsed && typeof parsed.narrativeSummary === 'string' && parsed.narrativeSummary.trim()) {
        let embedding: number[] | undefined;
        try {
          embedding = await generateEmbedding(
            `${parsed.narrativeSummary} ${(parsed.keyEventsAndDecisions || []).join(' ')} ${(
              parsed.userPreferencesAndFacts || []
            ).join(' ')}`
          );
        } catch {
          embedding = undefined;
        }

        return {
          ...fallbackSummary,
          narrativeSummary: parsed.narrativeSummary.trim(),
          keyEventsAndDecisions: Array.isArray(parsed.keyEventsAndDecisions)
            ? parsed.keyEventsAndDecisions.slice(0, 8)
            : fallbackSummary.keyEventsAndDecisions,
          userPreferencesAndFacts: Array.isArray(parsed.userPreferencesAndFacts)
            ? parsed.userPreferencesAndFacts.slice(0, 8)
            : fallbackSummary.userPreferencesAndFacts,
          unresolvedThreads: Array.isArray(parsed.unresolvedThreads)
            ? parsed.unresolvedThreads.slice(0, 6)
            : fallbackSummary.unresolvedThreads,
          emotionalArc:
            typeof parsed.emotionalArc === 'string' && parsed.emotionalArc.trim()
              ? parsed.emotionalArc.trim()
              : fallbackSummary.emotionalArc,
          ...(embedding ? { embedding } : {}),
        };
      }
    } catch {
      // Try next key or fall back cleanly to deterministic summary
    }
  }

  return fallbackSummary;
}
