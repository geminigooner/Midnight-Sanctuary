import { AppSettings, Gift, Memory, Message, UserProfile } from '../lib/types';
import { HydratedChatContext } from './firestoreContext.service';
import { resolveCanonicalEntityId } from '../lib/domains/entityDomain';
import { gemmaTools, SANCTUARY_TOOL_DEFINITIONS } from './harness/toolRegistry';
import {
  buildSerializedContents,
  buildSystemInstruction,
  createChatStreamFromContext,
  generateEmbedding,
  listAvailableModels,
  resolveAvailableApiKeys,
} from './harness/modelExecutionHarness';

export {
  gemmaTools,
  SANCTUARY_TOOL_DEFINITIONS,
  resolveAvailableApiKeys,
  generateEmbedding,
  listAvailableModels,
  buildSystemInstruction,
  buildSerializedContents,
  createChatStreamFromContext,
};

/**
 * Compatibility wrapper for direct stream creation from raw request parameters.
 */
export async function createChatStream(
  model: string,
  messages: Message[],
  settings: AppSettings,
  gifts: Gift[],
  profile: UserProfile | null,
  forceCloudflare?: boolean,
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH',
  includeThoughts?: boolean,
  temperature?: number,
  topP?: number,
  maxOutputTokens?: number,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const respondingEntityId =
    resolveCanonicalEntityId(model || settings?.model) || 'gemini-3.1-pro-preview';
  const context: HydratedChatContext = {
    model: model || settings?.model || 'models/gemini-3.1-pro-preview',
    respondingEntityId,
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
  };
  return createChatStreamFromContext(context, abortSignal || new AbortController().signal);
}
