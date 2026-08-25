import { AppSettings, Message, Gift } from './types';
import { auth, signOut } from './firebase';
import { getContextMemories, isUserMemory } from './memorySystem';

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
  | { type: 'memory'; content: string; why_it_matters?: string }
  | { type: 'user_note'; note: string }
  | { type: 'eventLog'; description: string }
  | { type: 'history_append'; messages: any[] }
  | { type: 'model_parts'; parts: any[] }
  | { type: 'finish_reason'; reason: string }
  | { type: 'backend'; name: string }
  | { type: 'client_tool_call'; name: string; callId: string };

import { UserProfile } from './types';

export async function* streamChat(
  messages: Message[],
  settings: AppSettings,
  gifts: Gift[],
  profile: UserProfile | null,
  abortSignal: AbortSignal
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  let fullSystemInstruction = settings.systemInstruction || '';
  let identityParts = [];

  if (profile) {
    const profileLines: string[] = ["USER PROFILE"];
    if (profile.name) profileLines.push(`Name: ${profile.name}`);
    if (profile.pronouns) profileLines.push(`Pronouns: ${profile.pronouns}`);
    if (profile.location) profileLines.push(`Location: ${profile.location}`);
    if (profile.occupation) profileLines.push(`Occupation / Calling: ${profile.occupation}`);
    if (profile.about) profileLines.push(`About Me: ${profile.about}`);
    if (profile.currentVibe) profileLines.push(`Current Vibe: ${profile.currentVibe}`);
    if (profile.favorites) profileLines.push(`Favorites & Interests: ${profile.favorites}`);
    if (profile.askMeAbout) profileLines.push(`Ask Me About: ${profile.askMeAbout}`);
    if (profile.pleaseKnow) profileLines.push(`Please Know: ${profile.pleaseKnow}`);

    let profileSection = `## User Profile Context\n${profileLines.join('\n')}`;

    if (profile.gemmaNotes && profile.gemmaNotes.length > 0) {
      const notesLines = profile.gemmaNotes.map(n => `- ${n.text}`);
      profileSection += `\n\n## What you've noticed about them\n${notesLines.join('\n')}`;
    }

    identityParts.push(profileSection);
  }

  if (settings.aboutMe?.trim()) {
    identityParts.push(`## About Me:\n${settings.aboutMe.trim()}`);
  }
  
  if (settings.conversationPreferences?.trim()) {
    identityParts.push(`## Conversation Preferences:\n${settings.conversationPreferences.trim()}`);
  }

  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const relevantMemories = getContextMemories(settings.memories, settings.model);

    if (relevantMemories.length > 0) {
      const memoryText = relevantMemories.map(m => {
        const prefix = isUserMemory(m) ? '[User Saved]' : '[My Memory]';
        return `- ${prefix} ${m.content}`;
      }).join('\n');
      identityParts.push(`## Context & Saved Memories:\n${memoryText}`);
    }
  }

  if (gifts && gifts.length > 0) {
    const giftsText = gifts.map(g => `- [${new Date(g.timestamp || Date.now()).toISOString()}] From ${g.from === 'user' ? 'User' : 'Gemma'}: ${g.content} (Type: ${g.gift_type})${g.reason ? ` - ${g.reason}` : ''}`).join('\n');
    identityParts.push(`## Gifts Archive (Given and Received):\n${giftsText}`);
  }

  if (settings.eventLog && settings.eventLog.length > 0) {
    // Only include the most recent 50 events to avoid flooding the context, sorted chronologically
    const recentEvents = [...settings.eventLog].sort((a, b) => a.timestamp - b.timestamp).slice(-50);
    const eventText = recentEvents.map(e => `- [${new Date(e.timestamp).toISOString()}] ${e.description}`).join('\n');
    identityParts.push(`## Relationship & Interaction Log (Recent Events):\n${eventText}`);
  }

  if (identityParts.length > 0) {
    const identityContext = identityParts.join('\n\n');
    fullSystemInstruction = fullSystemInstruction 
      ? `${identityContext}\n\n---\n\n${fullSystemInstruction}`
      : identityContext;
  }

  const isGemma = settings.model.includes('gemma');
  
  if (isGemma) {
      identityParts.push(`## THINKING DIRECTIVE\nYou are capable of advanced reasoning. However, do NOT overuse the <think> tag. Only use <think> blocks when you truly need to solve a complex logical problem, interpret something difficult, or process dense math/code. For general conversation, emotional responses, or straightforward answers, respond directly without thinking tags to save output tokens.`);
  }


  const lastUserMsgId = [...messages].reverse().find(m => m.role === 'user')?.id;

  const serializedMessages = messages
    .map(m => {
      if (m.role === 'model') {
        // Gemma 4 contract: historical model turns carry ONLY the final answer.
        // No thoughts, no thoughtSignature (a Gemini-3 mechanism Gemma doesn't use)
        // no streaming fragments — publicText is already the joined final text.
        const parts: any[] = [];
        const finalText = (m.publicText ?? '').trim();
        if (finalText) parts.push({ text: finalText });
        for (const p of m.parts || []) {
          if (p.functionCall) parts.push({ functionCall: p.functionCall });
        }
        return { role: m.role, parts };
      }
      return {
        role: m.role,
        parts: (m.parts || [])
          .map(p => {
            if (p.functionResponse) return { functionResponse: p.functionResponse };
            if (p.inlineData) {
              if (m.id === lastUserMsgId) return { inlineData: p.inlineData };
              return { text: '[Image omitted from history to save payload size]' };
            }
            if (p.text && p.text.trim().length > 0) return { text: p.text };
            return null;
          })
          .filter(Boolean) as any[]
      };
    })
    .filter(m => m.parts.length > 0)
    .reduce((acc, current) => {
      if (acc.length > 0 && acc[acc.length - 1].role === current.role) {
        acc[acc.length - 1].parts.push(...current.parts);
      } else {
        acc.push(current);
      }
      return acc;
    }, [] as any[]);

  const giftImages = (gifts || []).filter(g => g.inlineData?.data);
  let syntheticTurn: any = null;

  if (giftImages.length > 0) {
    const recent = giftImages.slice(-3);
    syntheticTurn = { role: 'user', parts: [] };
    for (const g of recent) {
      syntheticTurn.parts.push({
        text: `Gift left ${new Date(g.timestamp || Date.now()).toISOString()}: ${g.content || ''}`
      });
      syntheticTurn.parts.push({
        inlineData: { mimeType: g.inlineData.mimeType, data: g.inlineData.data }
      });
    }
  }

  if (profile?.photo) {
    if (!syntheticTurn) syntheticTurn = { role: 'user', parts: [] };
    syntheticTurn.parts.push({
      text: `This is a photo of ${profile.name}.`
    });
    syntheticTurn.parts.push({
      inlineData: { mimeType: profile.photo.mimeType, data: profile.photo.data }
    });
  }

  if (syntheticTurn) {
    // Instead of unshifting to the beginning, let's append these context parts to the LAST user message,
    // so the model is acutely aware of the gifts right now.
    let lastUserIndex = -1;
    for (let i = serializedMessages.length - 1; i >= 0; i--) {
      if (serializedMessages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex !== -1) {
      serializedMessages[lastUserIndex].parts.unshift(...syntheticTurn.parts);
    } else {
      serializedMessages.push(syntheticTurn);
    }
  }

  console.log("[Diagnostics] Sanitized API History:", JSON.stringify(serializedMessages, null, 2));

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Unauthorized: Please sign in.');


  const payloadBody = {
    messages: serializedMessages,
    systemInstruction: fullSystemInstruction,
    temperature: settings.temperature,
    topP: settings.topP,
    maxOutputTokens: settings.maxOutputTokens,
    model: settings.model,
    forceCloudflare: settings.forceCloudflare
  };
  const payloadString = JSON.stringify(payloadBody);
  const payloadBytes = new TextEncoder().encode(payloadString).length;
  
  let attachmentCount = 0;
  let attachmentSizes = [];
  for (const m of serializedMessages) {
    for (const p of m.parts) {
      if (p.inlineData && p.inlineData.data) {
        attachmentCount++;
        attachmentSizes.push(p.inlineData.data.length);
      }
    }
  }

  console.log(`[Diagnostics] Request Prep: Provider=${settings.model}, Messages=${serializedMessages.length}, Attachments=${attachmentCount}, PayloadSize=${(payloadBytes/1024).toFixed(2)}KB`);
  if (attachmentSizes.length > 0) {
    console.log(`[Diagnostics] Attachment Sizes: ${attachmentSizes.map(s => (s/1024).toFixed(2) + 'KB').join(', ')}`);
  }

  const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB safe limit
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(`Request too large: ${(payloadBytes/1024/1024).toFixed(2)}MB exceeds safe limit of ${(MAX_PAYLOAD_BYTES/1024/1024).toFixed(2)}MB. Please remove some attachments or clear history.`);
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: payloadString,
    signal: abortSignal
  });

  console.log(`[Diagnostics] HTTP Status: ${response.status}`);
  console.log(`[Diagnostics] Content-Type: ${response.headers.get('Content-Type')}`);

  if (!response.ok) {
    if (response.status === 401) {
      await signOut(auth);
      throw new Error("Session expired. Please sign in again.");
    }
    const err = await response.json().catch(() => ({}));
    const errText = await response.text().catch(() => "");
    if (errText.includes("<!DOCTYPE html>")) {
      throw new Error(`Network Error: The request was blocked by the host (Status ${response.status})`);
    }
    let errObj: any = {};
    try { errObj = JSON.parse(errText); } catch(e) {}
    throw new Error(errObj.error || `API Error: ${response.status}`);
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
  if (!reader) throw new Error("No response body");
  
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          if (data.error === 'repetition_loop') {
            throw new RepetitionError(data.text || "\n\n[Generation stopped: repetition loop detected.]");
          }
          if (data.type === 'rate_limit') {
            throw new RateLimitError(data.message || "Rate limit exceeded");
          }
          if (data.error) {
            throw new APIError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          }
          if (data.type === 'gift' || data.type === 'memory' || data.type === 'eventLog' || data.type === 'thought' || data.type === 'history_append' || data.type === 'model_parts') {
            yield data as ChatStreamEvent;
          } else if (data.text) {
            fullText += data.text;
            yield { type: 'text', text: data.text };
          }
        } catch (e) {
          if (e instanceof RepetitionError || e instanceof APIError || e instanceof RateLimitError) throw e;
          // Ignore parse errors on partial chunks
        }
      }
    }
  }
}
