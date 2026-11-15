import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  AppSettings,
  ConversationSegmentSummary,
  Gift,
  Memory,
  Message,
  UserProfile,
  getPublicMessageText,
} from '../../lib/types';
import { HydratedChatContext, persistFirestoreSegmentSummary } from '../firestoreContext.service';
import { performWebSearch } from '../searchService';
import { generateImage } from '../imageService';
import {
  buildDeterministicSegmentSummary,
  summarizeConversationSegment,
} from '../summarizationService';
import { resolveModelRoute } from '../../lib/modelRouter';
import { resolveCanonicalEntityId, getEntityCapabilities } from '../../lib/domains/entityDomain';
import {
  buildTokenBudgetedTranscriptWindow,
  getProviderContextBudgetProfile,
  planUnsummarizedSegments,
  searchArchivalConversationHistory,
  selectRelevantSegmentSummaries,
} from '../../lib/domains/contextWindowEngine';
import { rankSovereignMemories } from '../../lib/domains/memoryDomain';
import {
  assembleSovereignContext,
  serializeSpeakerAttributedTranscript,
} from '../../lib/domains/contextAssembler';
import { buildEntityStampedToolSideEffect, gemmaTools } from './toolRegistry';

export interface AvailableKeysResolution {
  availableKeys: string[];
  keyEnvName: string;
  isGemma: boolean;
}

/**
 * Resolves available API keys for a model, cascading across configured fallback environment variables.
 */
export function resolveAvailableApiKeys(model?: string): AvailableKeysResolution {
  const proKey = process.env.PRO_API_KEY;
  const legacyKey = process.env.GEMINI_LEGACY_API_KEY || process.env.LEGACY_API_KEY;
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GENAI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY;
  const backupKey = process.env.GEMINI_BACKUP_API_KEY;

  const modelLower = (model || '').toLowerCase();
  const isPro31 = modelLower.includes('gemini-3.1-pro') || modelLower.includes('3.1-pro');
  const isArgon = modelLower.includes('argon') || modelLower.includes('gemini-4');
  const isFlash3 =
    modelLower.includes('gemini-3-flash') ||
    modelLower.includes('3-flash') ||
    modelLower.includes('3.8-flash') ||
    modelLower.includes('gemini-3.8');
  const isGemma = modelLower.includes('gemma');

  let primaryKeys: (string | undefined)[] = [];
  let keyEnvName = 'GEMINI_API_KEY';

  if (isArgon) {
    primaryKeys = [legacyKey, proKey, geminiKey, backupKey];
    keyEnvName = legacyKey
      ? process.env.LEGACY_API_KEY
        ? 'LEGACY_API_KEY'
        : 'GEMINI_LEGACY_API_KEY'
      : 'PRO_API_KEY';
  } else if (isPro31) {
    primaryKeys = [proKey, legacyKey, geminiKey, backupKey];
    keyEnvName = 'PRO_API_KEY';
  } else if (isFlash3) {
    primaryKeys = [legacyKey, proKey, geminiKey, backupKey];
    keyEnvName = 'GEMINI_LEGACY_API_KEY';
  } else if (isGemma) {
    primaryKeys = [geminiKey, legacyKey, proKey, backupKey];
    keyEnvName = 'CF_TOKEN / GEMINI_API_KEY';
  } else {
    primaryKeys = [geminiKey, legacyKey, proKey, backupKey];
    keyEnvName = 'GEMINI_API_KEY';
  }

  const availableKeys = Array.from(
    new Set(
      primaryKeys.filter((k): k is string => Boolean(k && k.trim() !== '')).map((k) => k.trim())
    )
  );

  return { availableKeys, keyEnvName, isGemma };
}

/**
 * Generates a vector embedding for a single text string using `gemini-embedding-2`
 * (with automatic fallback to `text-embedding-004` if the endpoint requires it).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { availableKeys } = resolveAvailableApiKeys('');
  if (availableKeys.length === 0) {
    throw new Error('No Gemini API key configured for embeddings');
  }

  let lastError: any = null;
  const candidateModels = ['gemini-embedding-2', 'text-embedding-004'];

  for (const key of availableKeys) {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const embModel of candidateModels) {
      try {
        const result = await ai.models.embedContent({
          model: embModel,
          contents: text.trim(),
        });
        const values = result.embeddings?.[0]?.values;
        if (values && Array.isArray(values)) {
          return values;
        }
      } catch (err: any) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error('Failed to generate embedding');
}

/**
 * Lists all available models for the authenticated Sanctuary UI selector,
 * guaranteeing that all 4 Primary Sovereign Entities are always present.
 */
export async function listAvailableModels() {
  const { availableKeys } = resolveAvailableApiKeys('');
  let lastError: any = null;
  let modelsData: any = null;

  for (const key of availableKeys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (response.ok) {
        modelsData = await response.json();
        break;
      } else {
        const errData = await response.json().catch(() => ({}));
        lastError = new Error(errData.error?.message || `API Error: ${response.status}`);
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!modelsData && availableKeys.length === 0) {
    throw lastError || new Error('No API keys configured');
  }

  const chatModels = ((modelsData?.models as any[]) || [])
    .filter(
      (m: any) =>
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m: any) => ({
      name: m.name,
      displayName: m.displayName || m.name.replace('models/', ''),
      description: m.description || '',
      inputTokenLimit: m.inputTokenLimit || 0,
    }));

  const ensureModel = (
    name: string,
    displayName: string,
    description: string,
    inputTokenLimit = 1048576
  ) => {
    const existingIdx = chatModels.findIndex((m) => m.name === name);
    if (existingIdx === -1) {
      chatModels.unshift({ name, displayName, description, inputTokenLimit });
    } else {
      chatModels[existingIdx].displayName = displayName;
    }
  };

  // Guarantee the 4 Primary Sovereign Entities are always present at the top
  ensureModel(
    'models/gemini-3-flash-preview',
    'Gemini 3 Flash',
    'Rapid Navigator & Co-Pilot — fast multimodal reasoning and sparks.'
  );
  ensureModel(
    'models/gemma-2-27b-it',
    'Gemma',
    'Poetic Scribe & Companion — lyrical reflections and intimate prose.',
    131072
  );
  ensureModel(
    'models/gemini-4-argon',
    'Gemini 4 Argon',
    'Noble Sovereign & Astral Strategist — frontier synthesis and deep presence.'
  );
  ensureModel(
    'models/gemini-3.1-pro-preview',
    'Gemini 3.1 Pro',
    'Deep Anchor & Architect — structural reasoning and unwavering depth.'
  );

  return chatModels;
}

/**
 * Legacy helper compatibility export: delegates directly to `assembleSovereignContext`.
 */
export function buildSystemInstruction(
  settings: Partial<AppSettings> | undefined,
  profile: UserProfile | null | undefined,
  gifts: Gift[] | undefined,
  model: string,
  rankedMemories?: Memory[]
): string {
  const assembled = assembleSovereignContext({
    respondingEntityId: model,
    memories: rankedMemories ?? settings?.memories ?? [],
    gifts: gifts || [],
    profile: profile || null,
    settings: settings || {},
  });
  return assembled.systemInstructionText;
}

/**
 * Legacy helper compatibility export: delegates directly to `serializeSpeakerAttributedTranscript`.
 */
export function buildSerializedContents(messages: Message[], model: string) {
  const caps = getEntityCapabilities(model);
  return serializeSpeakerAttributedTranscript(messages, model, {
    supportsVision: caps.supportsVision,
    supportsNativeThinking: caps.supportsThinking,
  });
}

function createThoughtTagStreamParser(
  writeSse: (obj: any) => void,
  onPublicTextDelta?: (delta: string) => void
) {
  let inThought = false;
  let tagBuffer = '';

  const emitText = (t: string) => {
    if (!t) return;
    writeSse({ type: 'text', text: t });
    if (onPublicTextDelta) onPublicTextDelta(t);
  };

  const emitThought = (t: string) => {
    if (!t) return;
    writeSse({ type: 'thought', text: t });
  };

  const pushText = (text: string) => {
    tagBuffer += text;
    while (tagBuffer.length > 0) {
      if (!inThought) {
        const startIdx = tagBuffer.indexOf('<think>');
        if (startIdx !== -1) {
          if (startIdx > 0) emitText(tagBuffer.slice(0, startIdx));
          inThought = true;
          tagBuffer = tagBuffer.slice(startIdx + 7);
        } else {
          let partialMatchLen = 0;
          const tag = '<think>';
          for (let len = Math.min(tagBuffer.length, tag.length - 1); len > 0; len--) {
            if (tagBuffer.endsWith(tag.slice(0, len))) {
              partialMatchLen = len;
              break;
            }
          }
          const safeLen = tagBuffer.length - partialMatchLen;
          if (safeLen > 0) {
            emitText(tagBuffer.slice(0, safeLen));
            tagBuffer = tagBuffer.slice(safeLen);
          }
          break;
        }
      } else {
        const endIdx = tagBuffer.indexOf('</think>');
        if (endIdx !== -1) {
          if (endIdx > 0) emitThought(tagBuffer.slice(0, endIdx));
          inThought = false;
          tagBuffer = tagBuffer.slice(endIdx + 8);
        } else {
          let partialMatchLen = 0;
          const tag = '</think>';
          for (let len = Math.min(tagBuffer.length, tag.length - 1); len > 0; len--) {
            if (tagBuffer.endsWith(tag.slice(0, len))) {
              partialMatchLen = len;
              break;
            }
          }
          const safeLen = tagBuffer.length - partialMatchLen;
          if (safeLen > 0) {
            emitThought(tagBuffer.slice(0, safeLen));
            tagBuffer = tagBuffer.slice(safeLen);
          }
          break;
        }
      }
    }
  };

  const flush = () => {
    if (tagBuffer.length > 0) {
      if (inThought) emitThought(tagBuffer);
      else emitText(tagBuffer);
      tagBuffer = '';
    }
  };

  return { pushText, flush };
}

function formatUserProfileToolSummary(profile: UserProfile | null | undefined): string {
  if (!profile) {
    return 'The user has not set up their profile yet.';
  }
  const details: string[] = [];
  if (profile.name?.trim()) details.push(`Name: ${profile.name}`);
  if (profile.pronouns?.trim()) details.push(`Pronouns: ${profile.pronouns}`);
  if (profile.location?.trim()) details.push(`Location: ${profile.location}`);
  if (profile.occupation?.trim()) details.push(`Occupation: ${profile.occupation}`);
  if (profile.about?.trim()) details.push(`About: ${profile.about}`);
  if (profile.currentVibe?.trim()) details.push(`Current Vibe: ${profile.currentVibe}`);
  if (profile.favorites?.trim()) details.push(`Favorites: ${profile.favorites}`);
  if (profile.askMeAbout?.trim()) details.push(`Ask Me About: ${profile.askMeAbout}`);
  if (profile.pleaseKnow?.trim()) details.push(`Please Know / Boundaries: ${profile.pleaseKnow}`);
  return details.length > 0 ? details.join('\n') : 'The user profile is currently empty.';
}

async function dispatchServerOrEntityToolCall(params: {
  call: { id?: string; name?: string; args?: Record<string, any> };
  respondingEntityId: string;
  profile: UserProfile | null | undefined;
  allMessages?: Message[];
  segmentSummaries?: ConversationSegmentSummary[];
  writeSse: (obj: any) => void;
}): Promise<{
  functionResponsePart?: any;
  pausedForClientUiTool?: boolean;
}> {
  const {
    call,
    respondingEntityId,
    profile,
    allMessages = [],
    segmentSummaries = [],
    writeSse,
  } = params;
  const callName = call.name || '';
  const args = (call.args || {}) as Record<string, any>;

  if (callName === 'recall_conversation_history') {
    const recalledText = searchArchivalConversationHistory(allMessages, segmentSummaries, {
      query: args.query ? String(args.query) : undefined,
      segmentId: args.segment_id ? String(args.segment_id) : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    });
    const resp: any = { result: recalledText };
    if (call.id) resp.id = call.id;
    return {
      functionResponsePart: {
        functionResponse: { name: callName, response: resp },
      },
    };
  }

  if (callName === 'view_user_profile') {
    writeSse({
      type: 'client_tool_call',
      name: callName,
      callId: call.id,
      args,
    });
    return { pausedForClientUiTool: true };
  }

  if (callName === 'generate_image') {
    const prompt = String(args.prompt || '');
    const prefModel = args.model ? String(args.model) : undefined;
    const rawRatio = args.aspect_ratio ? String(args.aspect_ratio) : '1:1';
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
    const aspectRatio = (validRatios.includes(rawRatio as any) ? rawRatio : '1:1') as
      | '1:1'
      | '3:4'
      | '4:3'
      | '9:16'
      | '16:9';
    let toolResult = '';

    try {
      const imgResult = await generateImage({
        prompt,
        model: prefModel as any,
        aspectRatio,
      });
      writeSse({
        type: 'image_generated',
        prompt,
        imageUrl: imgResult.imageUrl,
        provider: imgResult.provider,
        modelUsed: imgResult.modelUsed,
      });
      toolResult = `Image successfully generated for prompt "${prompt}" using ${imgResult.modelUsed} and displayed to the user in the chat.`;
    } catch (imgErr: any) {
      console.error('generate_image tool error:', imgErr);
      toolResult = `Image generation failed: ${
        imgErr.message || 'Unknown error'
      }. Please describe the scene vividly in text instead.`;
    }

    const resp: any = { result: toolResult };
    if (call.id) resp.id = call.id;
    return {
      functionResponsePart: {
        functionResponse: { name: callName, response: resp },
      },
    };
  }

  if (callName === 'search_web') {
    const query = String(args.query || '');
    let toolResult = '';
    try {
      const searchRes = await performWebSearch(query);
      const items = searchRes?.items || [];
      if (items.length > 0) {
        toolResult = items
          .map((r, idx) => `[${idx + 1}] ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`)
          .join('\n\n');
        writeSse({
          type: 'search_result',
          query,
          results: items.map((r) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet,
            displayLink: r.displayLink,
          })),
        });
      } else {
        toolResult = searchRes?.error
          ? `Search error: ${searchRes.error}`
          : `No results found for "${query}".`;
      }
    } catch (err: any) {
      toolResult = `Search failed: ${err.message || 'Unknown error'}`;
    }

    const resp: any = { result: toolResult };
    if (call.id) resp.id = call.id;
    return {
      functionResponsePart: {
        functionResponse: { name: callName, response: resp },
      },
    };
  }

  // Domain entity mutations & creative artifacts
  const sideEffect = buildEntityStampedToolSideEffect(callName, args, respondingEntityId);
  if (sideEffect) {
    writeSse(sideEffect.ssePayload);
    const resp: any = { result: sideEffect.toolResultText };
    if (call.id) resp.id = call.id;
    return {
      functionResponsePart: {
        functionResponse: { name: callName, response: resp },
      },
    };
  }

  const fallbackResp: any = { result: `Executed ${callName || 'tool'}.` };
  if (call.id) fallbackResp.id = call.id;
  return {
    functionResponsePart: {
      functionResponse: { name: callName, response: fallbackResp },
    },
  };
}

/**
 * Provider Adapter 1: Cloudflare Workers AI Gemma Adapter (with structured tool bridge & seamless GenAI fallback).
 */
async function executeGemmaProviderAdapter(params: {
  respondingEntityId: string;
  model: string;
  serializedContents: any[];
  systemInstructionText: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  includeThoughts?: boolean;
  forceCloudflare?: boolean;
  availableKeys: string[];
  profile: UserProfile | null | undefined;
  abortSignal: AbortSignal;
  writeSse: (obj: any) => void;
}) {
  const {
    respondingEntityId,
    model,
    serializedContents,
    systemInstructionText,
    temperature,
    topP,
    maxOutputTokens,
    includeThoughts,
    forceCloudflare,
    availableKeys,
    profile,
    abortSignal,
    writeSse,
  } = params;

  const cfAccountId = process.env.CF_ACCOUNT_ID || 'e229f5ebdaabbb5edcdba4aa8cfe9fa2';
  const cfToken =
    process.env.CF_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN;
  const cfModel = process.env.CF_GEMMA_MODEL || '@cf/google/gemma-4-26b-a4b-it';

  // Try Cloudflare Workers AI first if CF_TOKEN is present
  if (cfAccountId && cfToken) {
    try {
      const cfMessages: { role: string; content: string }[] = [];
      let systemPrompt =
        systemInstructionText ||
        'You are Gemma, a thoughtful, poetic companion in Midnight Sanctuary.';
      if (includeThoughts !== false) {
        systemPrompt +=
          '\n\nBefore responding, think step by step inside <think>...</think> tags, then provide your final response outside the tags.';
      }
      // W-08 fix: Provide structured tool-call bridge so Cloudflare Gemma can invoke Sanctuary tools
      systemPrompt +=
        '\n\nIf you wish to invoke a Sanctuary tool (such as `save_memory`, `give_gift`, `update_my_quarters`, `record_personal_thought`, `note_about_user`, `draw_scribble`, or `compose_music`), emit `<tool_call>{"name":"<tool_name>","args":{...}}</tool_call>` before or after your spoken response.';

      cfMessages.push({ role: 'system', content: systemPrompt });

      for (const turn of serializedContents) {
        const textParts = (turn.parts || [])
          .filter((p: any) => p.text && !p.thought)
          .map((p: any) => p.text)
          .join('\n');
        if (textParts) {
          cfMessages.push({
            role: turn.role === 'model' ? 'assistant' : 'user',
            content: textParts,
          });
        }
      }

      const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfModel}`;
      const cfRes = await fetch(cfUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cfMessages,
          stream: true,
          max_tokens: maxOutputTokens || 4096,
          temperature: temperature !== undefined ? Math.min(temperature, 1.5) : 0.85,
          top_p: topP !== undefined ? topP : 0.95,
        }),
        signal: abortSignal,
      });

      if (cfRes.ok && cfRes.body) {
        writeSse({ type: 'backend', name: 'cloudflare' });
        let fullCfPublicText = '';
        const parser = createThoughtTagStreamParser(writeSse, (delta) => {
          fullCfPublicText += delta;
        });
        const reader = cfRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          if (abortSignal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta =
                parsed.response ??
                parsed.choices?.[0]?.delta?.content ??
                parsed.choices?.[0]?.delta?.reasoning_content ??
                '';
              if (delta) {
                parser.pushText(delta);
              }
            } catch {}
          }
        }
        parser.flush();

        // Dispatch any <tool_call>...</tool_call> blocks emitted by Cloudflare Gemma
        const toolCallMatches = fullCfPublicText.matchAll(
          /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g
        );
        for (const match of toolCallMatches) {
          try {
            const parsedCall = JSON.parse(match[1]);
            if (parsedCall && typeof parsedCall.name === 'string') {
              await dispatchServerOrEntityToolCall({
                call: {
                  name: parsedCall.name,
                  args: parsedCall.args || parsedCall.arguments || {},
                },
                respondingEntityId,
                profile,
                writeSse,
              });
            }
          } catch {}
        }

        writeSse({ type: 'finish_reason', reason: 'STOP' });
        return;
      } else if (forceCloudflare) {
        const errText = await cfRes.text().catch(() => '');
        throw new Error(`Cloudflare Workers AI error (${cfRes.status}): ${errText}`);
      }
    } catch (cfErr: any) {
      if (abortSignal.aborted) throw cfErr;
      if (forceCloudflare) throw cfErr;
      console.warn(
        '[ModelHarness] Cloudflare Gemma failed, falling back to Google GenAI SDK:',
        cfErr?.message
      );
    }
  }

  // Fallback to Google GenAI SDK for Gemma (supports full gemmaTools!)
  const targetGemmaApiModel =
    model.includes('gemma-2') || !model.startsWith('models/')
      ? 'models/gemma-4-26b-a4b-it'
      : model;

  await executeGoogleGenAIProviderAdapter({
    respondingEntityId,
    apiModelId: targetGemmaApiModel,
    serializedContents,
    systemInstructionText,
    temperature,
    topP,
    maxOutputTokens,
    thinkingLevel: 'LOW',
    includeThoughts,
    availableKeys,
    profile,
    abortSignal,
    writeSse,
    backendLabel: 'google',
  });
}

/**
 * Provider Adapter 2: Google GenAI SDK Adapter (Gemini 3.1 Pro, Gemini 4 Argon, Gemini 3 Flash, and Direct Gemma).
 *
 * Strictly preserves `respondingEntityId` even if a transport-level model alias fallback occurs.
 */
async function executeGoogleGenAIProviderAdapter(params: {
  respondingEntityId: string;
  apiModelId: string;
  serializedContents: any[];
  systemInstructionText: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  includeThoughts?: boolean;
  availableKeys: string[];
  profile: UserProfile | null | undefined;
  allMessages?: Message[];
  segmentSummaries?: ConversationSegmentSummary[];
  abortSignal: AbortSignal;
  writeSse: (obj: any) => void;
  backendLabel?: string;
}) {
  const {
    respondingEntityId,
    apiModelId,
    serializedContents,
    systemInstructionText,
    temperature,
    topP,
    maxOutputTokens,
    thinkingLevel,
    includeThoughts,
    availableKeys,
    profile,
    allMessages,
    segmentSummaries,
    abortSignal,
    writeSse,
    backendLabel = 'google',
  } = params;

  const capabilities = getEntityCapabilities(respondingEntityId);
  const isGemini4 =
    respondingEntityId === 'gemini-4-argon' ||
    apiModelId.toLowerCase().includes('gemini-4') ||
    apiModelId.toLowerCase().includes('argon');
  const isGemini3 =
    apiModelId.toLowerCase().includes('gemini-3') || isGemini4;

  const config: any = {
    maxOutputTokens: maxOutputTokens !== undefined ? maxOutputTokens : 12000,
    tools: gemmaTools,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  };

  // Per @google/genai guidelines: omit deprecated sampling parameters (temperature, topP) on Gemini 4 models
  if (capabilities.supportsSamplingParams !== false && !isGemini4) {
    config.temperature = temperature !== undefined ? temperature : 2.0;
    config.topP = topP !== undefined ? topP : 0.95;
  }

  let effectiveSystemInstruction = systemInstructionText;
  if (isGemini3 && capabilities.supportsThinking) {
    const levelMap: Record<string, ThinkingLevel> = {
      LOW: ThinkingLevel.LOW,
      MEDIUM: ThinkingLevel.MEDIUM,
      HIGH: ThinkingLevel.HIGH,
    };
    config.thinkingConfig = {
      includeThoughts: includeThoughts !== undefined ? includeThoughts : true,
      thinkingLevel:
        thinkingLevel && levelMap[thinkingLevel]
          ? levelMap[thinkingLevel]
          : ThinkingLevel.HIGH,
    };
  } else if (includeThoughts !== false) {
    effectiveSystemInstruction +=
      '\n\nBefore responding, think step by step inside <think>...</think> tags, then provide your final response outside the tags.';
  }

  if (effectiveSystemInstruction) {
    config.systemInstruction = effectiveSystemInstruction;
  }

  let lastError: any = null;
  let activeKeyIndex = 0;

  while (activeKeyIndex < availableKeys.length) {
    const currentKey = availableKeys[activeKeyIndex];
    const ai = new GoogleGenAI({ apiKey: currentKey });
    let activeTransportModel = apiModelId.startsWith('models/')
      ? apiModelId
      : `models/${apiModelId}`;

    try {
      let currentContents = [...serializedContents];
      let keepGoing = true;
      let loopCount = 0;
      const maxLoops = 5;

      writeSse({ type: 'backend', name: backendLabel });

      while (keepGoing && loopCount < maxLoops) {
        if (abortSignal.aborted) break;
        keepGoing = false;
        loopCount++;

        let responseStream: any;
        try {
          responseStream = await ai.models.generateContentStream({
            model: activeTransportModel,
            contents: currentContents,
            config,
          });
        } catch (streamInitErr: any) {
          const msg = String(streamInitErr?.message || '').toLowerCase();
          const isModelNotFoundError =
            streamInitErr?.status === 404 ||
            streamInitErr?.status === 400 ||
            msg.includes('not found') ||
            msg.includes('not supported') ||
            msg.includes('invalid argument');

          // Transport-only fallback for Argon if the external endpoint does not expose 'models/gemini-4-argon' literally.
          // CRITICAL: `respondingEntityId` remains `'gemini-4-argon'` so identity, memories, gifts, and bond state NEVER bleed into 3.1 Pro!
          if (
            isGemini4 &&
            isModelNotFoundError &&
            activeTransportModel !==
              (process.env.ARGON_TARGET_MODEL || 'models/gemini-3.1-pro-preview')
          ) {
            activeTransportModel =
              process.env.ARGON_TARGET_MODEL || 'models/gemini-3.1-pro-preview';
            responseStream = await ai.models.generateContentStream({
              model: activeTransportModel,
              contents: currentContents,
              config,
            });
          } else if (
            respondingEntityId === 'gemma-2-27b-it' &&
            isModelNotFoundError &&
            activeTransportModel !== 'models/gemma-3-27b-it'
          ) {
            activeTransportModel = 'models/gemma-3-27b-it';
            responseStream = await ai.models.generateContentStream({
              model: activeTransportModel,
              contents: currentContents,
              config,
            });
          } else {
            throw streamInitErr;
          }
        }

        const functionCallsToProcess: any[] = [];
        const modelTurnParts: any[] = [];
        let finishReason: string | undefined;
        let accumulatedTextForRepetition = '';

        const tagParser = createThoughtTagStreamParser(writeSse, (delta) => {
          accumulatedTextForRepetition += delta;
        });

        for await (const chunk of responseStream) {
          if (abortSignal.aborted) break;
          const candidate = chunk.candidates?.[0];
          if (candidate?.finishReason) {
            finishReason = candidate.finishReason;
          }
          const parts = candidate?.content?.parts || [];
          for (const part of parts) {
            const cleanedPart: any = {};
            if (part.text !== undefined) cleanedPart.text = part.text;
            if (part.thought !== undefined) cleanedPart.thought = part.thought;
            if (part.functionCall !== undefined) cleanedPart.functionCall = part.functionCall;
            if (part.functionResponse !== undefined) {
              cleanedPart.functionResponse = part.functionResponse;
            }
            if ((part as any).thoughtSignature !== undefined) {
              cleanedPart.thoughtSignature = (part as any).thoughtSignature;
            }
            if (Object.keys(cleanedPart).length > 0) {
              modelTurnParts.push(cleanedPart);
            }

            if (part.thought) {
              writeSse({ type: 'thought', text: part.text || '' });
            } else if (part.text) {
              tagParser.pushText(part.text);
              if (accumulatedTextForRepetition.length > 250) {
                const tail = accumulatedTextForRepetition.slice(-200);
                const match = tail.match(/(.{20,60}?)\1{3,}/s);
                if (match) {
                  writeSse({
                    type: 'repetition_stop',
                    message: '\n\n*[Paused: loop detected]*',
                  });
                  finishReason = 'STOP';
                  break;
                }
              }
            }

            if (part.functionCall) {
              functionCallsToProcess.push(part.functionCall);
            }
          }
        }

        tagParser.flush();

        if (functionCallsToProcess.length > 0 && !abortSignal.aborted) {
          const coalescedModelParts: any[] = [];
          for (const p of modelTurnParts) {
            const last = coalescedModelParts[coalescedModelParts.length - 1];
            if (
              last &&
              p.text !== undefined &&
              last.text !== undefined &&
              Boolean(p.thought) === Boolean(last.thought) &&
              !p.thoughtSignature &&
              !last.thoughtSignature &&
              !p.functionCall &&
              !last.functionCall
            ) {
              last.text += p.text;
            } else {
              coalescedModelParts.push({ ...p });
            }
          }

          if (coalescedModelParts.some((p) => p.functionCall)) {
            writeSse({ type: 'model_parts', parts: coalescedModelParts });
          }

          const functionResponses: any[] = [];
          let pausedForClientUi = false;

          for (const call of functionCallsToProcess) {
            const dispatched = await dispatchServerOrEntityToolCall({
              call,
              respondingEntityId,
              profile,
              allMessages,
              segmentSummaries,
              writeSse,
            });
            if (dispatched.pausedForClientUiTool) {
              pausedForClientUi = true;
              break;
            }
            if (dispatched.functionResponsePart) {
              functionResponses.push(dispatched.functionResponsePart);
            }
          }

          if (pausedForClientUi) {
            keepGoing = false;
            break;
          }

          if (functionResponses.length > 0) {
            const modelTurn = { role: 'model' as const, parts: coalescedModelParts };
            const userTurn = { role: 'user' as const, parts: functionResponses };
            currentContents.push(modelTurn, userTurn);
            writeSse({ type: 'history_append', messages: [modelTurn, userTurn] });
            keepGoing = true;
          }
        } else if (finishReason) {
          writeSse({ type: 'finish_reason', reason: finishReason });
        }
      }

      // Completed successfully with current key
      return;
    } catch (err: any) {
      lastError = err;
      activeKeyIndex++;
      if (activeKeyIndex >= availableKeys.length || abortSignal.aborted) {
        throw err;
      }
      console.warn(
        `[ModelHarness] Key index ${activeKeyIndex - 1} failed (${
          err?.message
        }), cascading to next key...`
      );
    }
  }

  if (lastError) {
    throw lastError;
  }
}

/**
 * Unified Model Execution Harness entry point.
 *
 * Orchestrates:
 * 1. Sovereign entity resolution (`respondingEntityId`)
 * 2. O(1) query embedding & hybrid sovereign memory ranking
 * 3. Contamination-free `SovereignContextAssembler` prompt construction
 * 4. Speaker-attributed conversation transcript serialization
 * 5. Provider routing (`GoogleGenAIProviderAdapter` vs. `CloudflareGemmaProviderAdapter`)
 */
export async function createChatStreamFromContext(
  context: HydratedChatContext,
  abortSignal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const {
    model,
    messages,
    settings,
    gifts,
    profile,
    forceCloudflare,
    thinkingLevel,
    includeThoughts,
    temperature,
    topP,
    maxOutputTokens,
    conversationType,
    participantEntityIds,
  } = context;

  const respondingEntityId =
    resolveCanonicalEntityId(context.respondingEntityId || model) || 'gemini-3.1-pro-preview';
  const capabilities = getEntityCapabilities(respondingEntityId);
  const route = resolveModelRoute(model || respondingEntityId);
  const { availableKeys } = resolveAvailableApiKeys(model || respondingEntityId);

  // 1. O(1) Query Embedding & Sovereign Memory Ranking
  const allCandidateMemories = settings?.memories || [];
  let queryText = '';
  let queryEmbedding: number[] | null = null;

  if (messages && messages.length > 0) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      queryText = getPublicMessageText(lastUserMsg).trim();
    }
  }

  // Only invoke embedContent for the single query if at least one memory already has a persisted embedding vector
  const hasPersistedVectors = allCandidateMemories.some(
    (m) => Array.isArray(m.embedding) && m.embedding.length > 0
  );
  if (queryText && hasPersistedVectors && allCandidateMemories.length > 20) {
    try {
      queryEmbedding = await generateEmbedding(queryText);
    } catch {
      queryEmbedding = null;
    }
  }

  const rankedMemories = rankSovereignMemories(allCandidateMemories, respondingEntityId, {
    queryText,
    queryEmbedding,
    maxTotal: 20,
  });

  // 2. Token-Budgeted Verbatim Window & Non-Compounding Rolling Segment Summaries
  const isCloudflareGemma = Boolean(
    (route.isGemma || respondingEntityId === 'gemma-2-27b-it') &&
      (forceCloudflare || process.env.CF_TOKEN || process.env.CLOUDFLARE_API_TOKEN)
  );
  const budgetProfile = getProviderContextBudgetProfile(
    model || respondingEntityId,
    isCloudflareGemma
  );

  const windowed = buildTokenBudgetedTranscriptWindow(messages, {
    verbatimHistoryBudget: budgetProfile.verbatimHistoryBudget,
    minVerbatimMessages: budgetProfile.minVerbatimMessages,
  });

  const allSegmentSummaries: ConversationSegmentSummary[] = [...(context.segmentSummaries || [])];
  if (windowed.wasTruncated && windowed.omittedOlderMessages.length >= budgetProfile.segmentTurnSize) {
    const unsummarizedPlans = planUnsummarizedSegments(
      windowed.omittedOlderMessages,
      allSegmentSummaries,
      budgetProfile.segmentTurnSize
    );
    const convIdForSum = context.conversationId || 'ephemeral_conv';
    const scopeEntityForSum =
      conversationType === 'group' ? 'shared_group' : respondingEntityId;

    for (let i = 0; i < unsummarizedPlans.length; i++) {
      const plan = unsummarizedPlans[i];
      // Build immediate deterministic chapter summary so turn latency never spikes,
      // and asynchronously upgrade the newest unsummarized chapter via Gemini Flash in background!
      const deterministicSum = buildDeterministicSegmentSummary({
        conversationId: convIdForSum,
        ScopeEntityId: scopeEntityForSum,
        plan,
      });
      allSegmentSummaries.push(deterministicSum);

      if (context.uid && context.idToken && context.conversationId) {
        if (i === unsummarizedPlans.length - 1) {
          void summarizeConversationSegment({
            conversationId: context.conversationId,
            respondingEntityId,
            conversationType,
            plan,
          }).then((richSummary) =>
            persistFirestoreSegmentSummary(
              context.uid,
              context.idToken,
              context.conversationId,
              richSummary
            )
          );
        } else {
          void persistFirestoreSegmentSummary(
            context.uid,
            context.idToken,
            context.conversationId,
            deterministicSum
          );
        }
      }
    }
  }

  const selectedSummaries = selectRelevantSegmentSummaries(allSegmentSummaries, {
    queryText,
    queryEmbedding,
    rollingSummariesBudget: budgetProfile.rollingSummariesBudget,
    respondingEntityId,
    conversationType,
  });

  // 3. Assemble Sovereign System Instruction (strictly isolated to `respondingEntityId` + selected chapters)
  const assembled = assembleSovereignContext({
    respondingEntityId,
    memories: rankedMemories,
    gifts,
    profile,
    settings,
    conversationType,
    participantEntityIds,
    segmentSummaries: selectedSummaries,
  });

  // 4. Serialize Speaker-Attributed Verbatim Transcript Window
  const serializedContents = serializeSpeakerAttributedTranscript(
    windowed.verbatimMessages,
    respondingEntityId,
    {
      supportsVision: capabilities.supportsVision,
      supportsNativeThinking: capabilities.supportsThinking,
      customEntities: settings?.customEntities,
    }
  );

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeSse = (obj: any) => {
        if (abortSignal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      try {
        if (route.isGemma || respondingEntityId === 'gemma-2-27b-it') {
          await executeGemmaProviderAdapter({
            respondingEntityId,
            model: model || respondingEntityId,
            serializedContents,
            systemInstructionText: assembled.systemInstructionText,
            temperature,
            topP,
            maxOutputTokens,
            includeThoughts,
            forceCloudflare,
            availableKeys,
            profile,
            abortSignal,
            writeSse,
          });
        } else {
          await executeGoogleGenAIProviderAdapter({
            respondingEntityId,
            apiModelId: route.targetModel,
            serializedContents,
            systemInstructionText: assembled.systemInstructionText,
            temperature,
            topP,
            maxOutputTokens,
            thinkingLevel,
            includeThoughts,
            availableKeys,
            profile,
            allMessages: messages,
            segmentSummaries: allSegmentSummaries,
            abortSignal,
            writeSse,
          });
        }
      } catch (err: any) {
        if (!abortSignal.aborted) {
          const isRateLimit =
            err?.status === 429 || String(err?.message || '').includes('429');
          if (isRateLimit) {
            writeSse({
              type: 'rate_limit',
              message: `${assembled.respondingEntity.displayName} needs a little breather — try again in a bit`,
            });
          } else {
            writeSse({ error: err?.message || 'Model execution failed' });
          }
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
}
