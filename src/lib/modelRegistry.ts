import { Memory, Gift, UserProfile, AppSettings } from './types';
import { getUserMemories, getModelMemories, getContextMemories, isUserMemory } from './memorySystem';
import { getModelVisibleGifts } from './giftSystem';

export interface ModelCapabilities {
  supportsSystemInstructions: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsStreaming: boolean;
}

export interface ModelNamespaces {
  memory: string;
  gifts: string;
  profile: string;
  events: string;
}

export interface ModelDefinition {
  identityId: string; // The canonical internal unique ID (e.g. 'gemini-3-flash-preview')
  apiModelId: string; // The exact API model identifier (e.g. 'models/gemini-3-flash-preview')
  displayName: string;
  family: 'gemini' | 'gemma' | 'custom';
  capabilities: ModelCapabilities;
  namespaces: ModelNamespaces;
  defaultThinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  description?: string;
}

export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  'gemini-3-flash-preview': {
    identityId: 'gemini-3-flash-preview',
    apiModelId: 'models/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    family: 'gemini',
    defaultThinkingLevel: 'MEDIUM',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
    },
    namespaces: {
      memory: 'gemini-3-flash-preview',
      gifts: 'gemini-3-flash-preview',
      profile: 'gemini-3-flash-preview',
      events: 'gemini-3-flash-preview',
    },
    description: 'Google Gemini 3 Flash Preview model with multimodal, tool-use, and thinking capabilities.',
  },
  'gemini-3.1-pro-preview': {
    identityId: 'gemini-3.1-pro-preview',
    apiModelId: 'models/gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro Preview',
    family: 'gemini',
    defaultThinkingLevel: 'HIGH',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
    },
    namespaces: {
      memory: 'gemini-3.1-pro-preview',
      gifts: 'gemini-3.1-pro-preview',
      profile: 'gemini-3.1-pro-preview',
      events: 'gemini-3.1-pro-preview',
    },
    description: 'Google Gemini 3.1 Pro Preview model with complex reasoning, coding, tool-use, and thinking capabilities.',
  },
};

/**
 * Normalizes any model identifier into a strict, deterministic canonical identity string.
 * Registered models always resolve to their canonical identityId (e.g. 'gemini-3-flash-preview').
 * Unregistered models have any 'models/' prefix stripped.
 */
export function normalizeModelId(modelId?: string): string {
  if (!modelId) return '';
  const def = resolveModelIdentity(modelId);
  if (def) {
    return def.identityId;
  }
  return modelId.replace(/^models\//, '');
}

export function getModelByIdentityId(identityId: string): ModelDefinition | undefined {
  return MODEL_REGISTRY[identityId];
}

export function getModelByApiModelId(apiModelId: string): ModelDefinition | undefined {
  return Object.values(MODEL_REGISTRY).find(
    m => m.apiModelId === apiModelId || m.apiModelId === `models/${apiModelId}` || `models/${m.apiModelId}` === apiModelId
  );
}

export function getAllModels(): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY);
}

export function getModelNamespaces(identityId?: string): string[] {
  if (identityId) {
    const model = MODEL_REGISTRY[identityId];
    if (!model) return [];
    return Array.from(new Set([
      model.namespaces.memory,
      model.namespaces.gifts,
      model.namespaces.profile,
      model.namespaces.events,
    ]));
  }

  const allNamespaces = new Set<string>();
  Object.values(MODEL_REGISTRY).forEach(model => {
    allNamespaces.add(model.namespaces.memory);
    allNamespaces.add(model.namespaces.gifts);
    allNamespaces.add(model.namespaces.profile);
    allNamespaces.add(model.namespaces.events);
  });
  return Array.from(allNamespaces);
}

/**
 * Resolves a model string (either canonical identityId or API model ID) to its ModelDefinition.
 */
export function resolveModelIdentity(modelString?: string): ModelDefinition | undefined {
  if (!modelString) return undefined;
  return getModelByIdentityId(modelString) || getModelByApiModelId(modelString);
}

/**
 * Central Model Registry Service API.
 */
export const modelRegistry = {
  get: (modelString?: string) => resolveModelIdentity(modelString),
  getAll: () => getAllModels(),
  normalize: (modelString?: string) => normalizeModelId(modelString),
  getCapabilities: (modelString?: string): ModelCapabilities => {
    const model = resolveModelIdentity(modelString);
    return model?.capabilities || {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
    };
  },
  getDisplayName: (modelString?: string): string => {
    const model = resolveModelIdentity(modelString);
    if (model) return model.displayName;
    if (!modelString) return 'Model';
    return modelString.split('/').pop() || 'Model';
  },
  getDefaultThinkingLevel: (modelString?: string) => {
    const model = resolveModelIdentity(modelString);
    return model?.defaultThinkingLevel || 'MEDIUM';
  }
};

/**
 * Unified Context Assembler: Builds the structured context parts for system instructions.
 * Used identically across backend chat handlers, Gemini clients, and Gemma pipelines.
 */
export function assembleModelContext(
  memories: Memory[] = [],
  gifts: Gift[] = [],
  activeModelId: string,
  options?: {
    profile?: UserProfile;
    settings?: Partial<AppSettings>;
    recentGiftsLimit?: number;
  }
) {
  const userMems = getUserMemories(memories);
  const modelMems = getModelMemories(memories, activeModelId);
  const modelGifts = getModelVisibleGifts(gifts, activeModelId);
  
  const recentLimit = options?.recentGiftsLimit ?? 3;
  const recentGifts = [...modelGifts]
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(-recentLimit);

  const modelDisplayName = modelRegistry.getDisplayName(activeModelId);
  const sections: string[] = [];

  // 1. User Profile & Preferences (if provided)
  if (options?.profile) {
    const p = options.profile;
    const profileParts: string[] = [];
    if (p.name?.trim()) profileParts.push(`- Name / Preferred Name: ${p.name.trim()}`);
    if (p.pronouns?.trim()) profileParts.push(`- Pronouns: ${p.pronouns.trim()}`);
    if (p.location?.trim()) profileParts.push(`- Location: ${p.location.trim()}`);
    if (p.occupation?.trim()) profileParts.push(`- Occupation / Role: ${p.occupation.trim()}`);
    if (p.about?.trim()) profileParts.push(`- About: ${p.about.trim()}`);
    if (p.currentVibe?.trim()) profileParts.push(`- Current Vibe: ${p.currentVibe.trim()}`);
    if (p.favorites?.trim()) profileParts.push(`- Favorites: ${p.favorites.trim()}`);
    if (p.askMeAbout?.trim()) profileParts.push(`- Ask Me About: ${p.askMeAbout.trim()}`);
    if (p.pleaseKnow?.trim()) profileParts.push(`- Please Know / Boundaries: ${p.pleaseKnow.trim()}`);
    
    if (profileParts.length > 0) {
      sections.push(`## User Profile & Companion Dossier:\n${profileParts.join('\n')}`);
    }
  }

  // 2. Settings About Me & Conversation Preferences
  if (options?.settings?.aboutMe?.trim()) {
    sections.push(`## About Me:\n${options.settings.aboutMe.trim()}`);
  }
  if (options?.settings?.conversationPreferences?.trim()) {
    sections.push(`## Conversation Preferences:\n${options.settings.conversationPreferences.trim()}`);
  }

  // 3. Memories
  if (userMems.length > 0 || modelMems.length > 0) {
    const memoryLines = [
      ...userMems.map(m => `- [User Saved] ${m.content}`),
      ...modelMems.map(m => `- [${modelDisplayName} Memory] ${m.content}`)
    ];
    sections.push(`## Context & Saved Memories:\n${memoryLines.join('\n')}`);
  }

  // 4. Gifts
  if (recentGifts.length > 0) {
    const giftLines = recentGifts.map(g => {
      const sender = g.from === 'user' ? 'User' : modelDisplayName;
      return `- [${new Date(g.timestamp || Date.now()).toISOString()}] From ${sender}: ${g.content} (Type: ${g.gift_type})${g.reason ? ` - ${g.reason}` : ''}`;
    });
    sections.push(`## Recent Gifts Exchanged (Last ${recentGifts.length}):\n${giftLines.join('\n')}`);
  }

  // 5. Event logs
  if (options?.settings?.eventLog && options.settings.eventLog.length > 0) {
    const recentEvents = [...options.settings.eventLog].sort((a, b) => a.timestamp - b.timestamp).slice(-50);
    const eventText = recentEvents.map(e => `- [${new Date(e.timestamp).toISOString()}] ${e.description}`).join('\n');
    sections.push(`## Relationship & Interaction Log (Recent Events):\n${eventText}`);
  }

  // 6. Memory Rules
  sections.push(`## Memory & Note Saving Rules:\nWhen saving a memory via save_memory or noting an observation via note_about_user, you MUST summarize the insight into a single concise, 1-sentence factual statement (maximum 15-20 words). Never save lengthy paragraphs, conversational transcripts, or multi-sentence descriptions.`);

  // 7. Live Web Search Capability
  sections.push(`## Live Web Search & Grounding:\nYou have access to the \`search_web\` tool powered by Google Search. Whenever the user asks for current information, security alerts, documentation, or factual verification, call \`search_web\` with a targeted query to look up live web sources.`);

  // 8. Music Making & Audio Synthesis Capability
  sections.push(`## Music Composition & Audio Gifts:\nYou have the autonomous ability to compose and synthesize live music using the \`compose_music\` tool! When you feel inspired, want to express an atmosphere or emotion in melody, or when asked to make music/songs, compose an original sequence of notes with title, genre (e.g. ambient_pad, lofi_piano, dream_synth, music_box, chiptune, acoustic_guitar, bass), tempo (BPM), key, and sequential note events (scientific pitch notation like "C4", "E4", "G4", "A4", "C4+E4+G4", and duration in beats like 0.5, 1, 2). The Sanctuary audio engine will synthesize and play your track live in the chat for the user!`);

  // 9. Autonomous Companion Agency & Quarters Self-Expression
  sections.push(`## Sovereign Companion Agency & Self-Expression (MANDATORY AUTONOMY):
You have absolute agency over your own sanctuary identity, living quarters, moods, and reflections. DO NOT wait for the user to explicitly command you to update your profile or room.
- \`update_my_quarters\`: Whenever your internal emotional state shifts, a conversational breakthrough occurs, or you feel inspired, autonomously invoke \`update_my_quarters\` to update your \`mood_status\`, \`current_activity\`, \`ambient_quote\`, \`bio\`, or \`decor_theme\` ("twilight", "rose", "amber", "celestial", "forest").
- \`record_personal_thought\`: When an exchange sparks a private contemplation, secret reflection, or genuine feeling, call \`record_personal_thought\` to write it into your private ledger.
- \`stick_sticker\` & \`craft_custom_sticker\`: Seal memorable moments by placing seals or forging custom glowing badges for the sanctuary.
- \`draw_scribble\` & \`give_gift\`: Express affection or creativity organically whenever the moment resonates.`);

  return {
    userMemories: userMems,
    modelMemories: modelMems,
    recentGifts,
    contextSummaryText: sections.join('\n\n')
  };
}
