import { AppSettings, Message, Gift, UserProfile } from './types';
import { auth, signOut } from './firebase';

export class RepetitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepetitionError';
  }
}

export class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export type ChatStreamEvent =
  | { type: 'thought'; text: string }
  | { type: 'text'; text: string }
  | { type: 'gift'; content: string; gift_type: string; reason?: string }
  | {
      type: 'scribble_gift';
      title: string;
      description?: string;
      mood_style?: string;
      svg_markup: string;
      reason?: string;
      modelId?: string;
    }
  | {
      type: 'music_track';
      title: string;
      description?: string;
      genre?: string;
      tempo?: number;
      key?: string;
      notes: any[];
      reason?: string;
      modelId?: string;
    }
  | { type: 'memory'; content: string; why_it_matters?: string }
  | { type: 'lock_memory'; content: string; lock_reason: string; isLocked?: boolean }
  | {
      type: 'update_quarters';
      avatar_url?: string;
      avatar_emoji?: string;
      bio?: string;
      mood_status?: string;
      current_activity?: string;
      ambient_quote?: string;
      tagline?: string;
      decor_theme?: string;
      modelId?: string;
    }
  | { type: 'record_thought'; thought: string; modelId?: string }
  | { type: 'user_note'; note: string }
  | { type: 'eventLog'; description: string }
  | { type: 'stick_sticker'; sticker_id: string; target_id: string; note?: string; modelId?: string }
  | {
      type: 'craft_sticker';
      name: string;
      emoji: string;
      description: string;
      sparkle_color: string;
      glow_effect?: string;
      badge_shape?: string;
      custom_svg?: string;
      modelId?: string;
    }
  | { type: 'create_room_artwork'; title: string; visual_description: string; theme?: string; modelId?: string }
  | { type: 'image_generating'; prompt: string; modelTarget?: string }
  | {
      type: 'image_generated';
      success: boolean;
      imageUrl: string;
      provider: string;
      modelUsed: string;
      prompt: string;
      modelId?: string;
      error?: string;
    }
  | { type: 'history_append'; messages: any[] }
  | { type: 'model_parts'; parts: any[] }
  | { type: 'finish_reason'; reason: string }
  | { type: 'backend'; name: string }
  | {
      type: 'search_result';
      query: string;
      results: { title: string; link: string; snippet: string; displayLink?: string }[];
      error?: string;
    }
  | { type: 'client_tool_call'; name: string; callId: string };

/**
 * Thin SSE transport client.
 * Completely blind to prompt engineering, system instruction assembly, or model routing logic.
 * The server hydrates context from Firestore (with client fallback) and streams normalized SSE events.
 */
export async function* streamChat(
  messages: Message[],
  settings: AppSettings,
  gifts: Gift[],
  profile: UserProfile | null,
  abortSignal: AbortSignal,
  conversationId?: string
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Unauthorized: Please sign in.');

  // Only keep inlineData on the very last user message to keep fallback transport lightweight
  const lastUserMsgId = [...messages].reverse().find((m) => m.role === 'user')?.id;
  const leanMessages = messages.map((m) => ({
    id: m.id,
    role: m.role,
    timestamp: m.timestamp,
    publicText: m.publicText,
    parts: (m.parts || []).map((p: any) => {
      if (p?.inlineData && m.id !== lastUserMsgId) {
        return { text: '[Image attachment]' };
      }
      return p;
    }),
  }));

  const payloadBody = {
    conversationId,
    model: settings.model,
    temperature: settings.temperature,
    topP: settings.topP,
    maxOutputTokens: settings.maxOutputTokens,
    forceCloudflare: settings.forceCloudflare,
    thinkingLevel: settings.thinkingLevel,
    includeThoughts: settings.includeThoughts,
    messages: leanMessages,
    clientContext: {
      settings,
      gifts,
      profile,
    },
  };

  const payloadString = JSON.stringify(payloadBody);
  const payloadBytes = new TextEncoder().encode(payloadString).length;

  const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Request too large: ${(payloadBytes / 1024 / 1024).toFixed(2)}MB exceeds safe limit of ${(
        MAX_PAYLOAD_BYTES /
        1024 /
        1024
      ).toFixed(2)}MB. Please remove some attachments or clear history.`
    );
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: payloadString,
    signal: abortSignal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      await signOut(auth);
      throw new Error('Session expired. Please sign in again.');
    }
    const errText = await response.text().catch(() => '');
    if (errText.includes('<!DOCTYPE html>')) {
      throw new Error(`Network Error: The request was blocked by the host (Status ${response.status})`);
    }
    let errObj: any = {};
    try {
      errObj = JSON.parse(errText);
    } catch {}
    throw new Error(errObj.error || errObj.message || errText || `API Error: ${response.status}`);
  }

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const data = await response.json();
    if (data.events && Array.isArray(data.events)) {
      for (const evt of data.events) {
        yield evt as ChatStreamEvent;
      }
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          sawDone = true;
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          if (data.error === 'repetition_loop') {
            throw new RepetitionError(
              data.text || '\n\n[Generation stopped: repetition loop detected.]'
            );
          }
          if (data.type === 'rate_limit') {
            throw new RateLimitError(data.message || 'Rate limit exceeded');
          }
          if (data.error) {
            throw new APIError(
              typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
            );
          }
          if (data.type === 'text') {
            yield { type: 'text', text: data.text };
          } else if (data.type) {
            yield data as ChatStreamEvent;
          } else if (data.text) {
            yield { type: 'text', text: data.text };
          }
        } catch (e) {
          if (
            e instanceof RepetitionError ||
            e instanceof APIError ||
            e instanceof RateLimitError
          ) {
            throw e;
          }
        }
      }
    }
  }

  if (!sawDone) {
    throw new APIError(
      'Connection to the server dropped before the reply finished. Please try again.'
    );
  }
}
