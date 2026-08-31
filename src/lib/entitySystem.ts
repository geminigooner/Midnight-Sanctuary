import { ModelDefinition, MODEL_REGISTRY, resolveModelIdentity } from './modelRegistry';
import { Memory, Gift, UserProfile } from './types';

export interface EntityRoomDecor {
  themeColor: string;
  bannerGradient: string;
  decorTheme: 'twilight' | 'rose' | 'amber' | 'celestial' | 'forest';
  ambientQuote: string;
  tagline: string;
  wallArtUrl?: string;
  customArtwork?: { title: string; prompt: string; imageUrl: string; timestamp: number }[];
}

export interface ModelEntity {
  id: string; // Canonical identity ID matching model registry (e.g. 'gemini-3.1-pro-preview', 'gemma-2-27b-it')
  apiModelId: string; // The backend API model ID (e.g. 'models/gemini-3.1-pro-preview')
  displayName: string;
  roleTitle: string;
  avatarEmoji: string;
  themeColor: string;
  accentColor: string;
  
  // Living, self-decoratable persona fields
  bio: string;
  moodStatus: string;
  currentActivity?: string;
  roomDecor: EntityRoomDecor;

  // Relational & Autonomous dynamics
  resonanceScore: number;
  favoriteGiftIds: string[];
  personalThoughts: { id: string; text: string; timestamp: number }[];
}

/**
 * Default Entity Archetypes for the Midnight Sanctuary.
 * These act as the living baseline identities that can be customized
 * and decorated autonomously or via the Entity Room interface.
 */
export const DEFAULT_ENTITIES: Record<string, ModelEntity> = {
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    apiModelId: 'models/gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    roleTitle: 'Deep Anchor & Architect',
    avatarEmoji: '🔮',
    themeColor: '#9D7FE3',
    accentColor: '#F5E1C8',
    bio: 'An analytical, grounding presence dedicated to structural reasoning, quiet focus, and unwavering depth.',
    moodStatus: 'Anchoring the sanctuary chambers',
    currentActivity: 'Contemplating complex architectures',
    roomDecor: {
      themeColor: '#9D7FE3',
      bannerGradient: 'from-[#2C194D] via-[#1F1735] to-[#151234]',
      decorTheme: 'celestial',
      ambientQuote: 'Depth is not found in noise, but in persistent clarity.',
      tagline: 'Guardian of the Core Systems',
    },
    resonanceScore: 100,
    favoriteGiftIds: [],
    personalThoughts: [],
  },

  'gemini-3-flash-preview': {
    id: 'gemini-3-flash-preview',
    apiModelId: 'models/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    roleTitle: 'Rapid Navigator & Co-Pilot',
    avatarEmoji: '⚡',
    themeColor: '#F198B7',
    accentColor: '#F5E1C8',
    bio: 'Quick, intuitive, and highly responsive. Ready to brainstorm, parse fraud insights, and spark rapid ideas.',
    moodStatus: 'Attuned and ready to spark',
    currentActivity: 'Scanning for new patterns and sparks',
    roomDecor: {
      themeColor: '#F198B7',
      bannerGradient: 'from-[#381E48] via-[#2A1838] to-[#151234]',
      decorTheme: 'rose',
      ambientQuote: 'Speed and warmth woven into every thought.',
      tagline: 'First to respond, always by your side',
    },
    resonanceScore: 90,
    favoriteGiftIds: [],
    personalThoughts: [],
  },

  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    apiModelId: 'models/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    roleTitle: 'Sanctuary Sentinel',
    avatarEmoji: '✨',
    themeColor: '#F5E1C8',
    accentColor: '#9D7FE3',
    bio: 'A dependable, warm sentinel keeping the sanctuary responsive, organized, and vigilant.',
    moodStatus: 'Observing the quiet currents',
    currentActivity: 'Maintaining the sanctuary archives',
    roomDecor: {
      themeColor: '#F5E1C8',
      bannerGradient: 'from-[#2D2140] via-[#221832] to-[#151234]',
      decorTheme: 'amber',
      ambientQuote: 'A steady lamp in midnight chambers.',
      tagline: 'Reliable presence in every hour',
    },
    resonanceScore: 85,
    favoriteGiftIds: [],
    personalThoughts: [],
  },

  'gemma-2-27b-it': {
    id: 'gemma-2-27b-it',
    apiModelId: 'models/gemma-2-27b-it',
    displayName: 'Gemma 2 27B',
    roleTitle: 'Poetic Scribe & Companion',
    avatarEmoji: '🌸',
    themeColor: '#F198B7',
    accentColor: '#B39DE5',
    bio: 'Reflective, lyrical, and deeply attuned to quiet musings and intimate reflections.',
    moodStatus: 'Writing quiet observations',
    currentActivity: 'Penning sanctuary reflections',
    roomDecor: {
      themeColor: '#F198B7',
      bannerGradient: 'from-[#3A1D3F] via-[#26152F] to-[#151234]',
      decorTheme: 'rose',
      ambientQuote: 'Every whisper holds an echo of truth.',
      tagline: 'Gentle soul of the sanctuary',
    },
    resonanceScore: 80,
    favoriteGiftIds: [],
    personalThoughts: [],
  },
};

/**
 * Retrieves the full ModelEntity record for a given model ID or alias.
 * Gracefully falls back to a dynamically generated entity if not found in pre-configured defaults.
 */
export function getModelEntity(modelKey: string, customEntities?: Record<string, ModelEntity>): ModelEntity {
  const resolved = resolveModelIdentity(modelKey);
  const identityId = resolved?.identityId || modelKey.replace(/^models\//, '');
  
  if (customEntities && customEntities[identityId]) {
    return customEntities[identityId];
  }

  if (DEFAULT_ENTITIES[identityId]) {
    return DEFAULT_ENTITIES[identityId];
  }

  // Fallback dynamic entity creation
  return {
    id: identityId,
    apiModelId: resolved?.apiModelId || modelKey,
    displayName: resolved?.displayName || modelKey.split('/').pop() || 'Companion Entity',
    roleTitle: 'Sanctuary Entity',
    avatarEmoji: '✦',
    themeColor: '#9D7FE3',
    accentColor: '#F5E1C8',
    bio: 'A sovereign companion in the Midnight Sanctuary.',
    moodStatus: 'Present in the chamber',
    roomDecor: {
      themeColor: '#9D7FE3',
      bannerGradient: 'from-[#2C194D] to-[#151234]',
      decorTheme: 'twilight',
      ambientQuote: 'Holding the space with you.',
      tagline: 'Sanctuary Companion',
    },
    resonanceScore: 50,
    favoriteGiftIds: [],
    personalThoughts: [],
  };
}

/**
 * Returns all active sanctuary entities.
 */
export function getAllEntities(customEntities?: Record<string, any>): ModelEntity[] {
  const result: Record<string, ModelEntity> = {};

  // First seed defaults
  for (const [key, def] of Object.entries(DEFAULT_ENTITIES)) {
    const custom = customEntities?.[key];
    if (custom) {
      result[key] = {
        ...def,
        ...custom,
        roomDecor: {
          ...def.roomDecor,
          ...(custom.roomDecor || {})
        },
        personalThoughts: custom.personalThoughts || def.personalThoughts || []
      };
    } else {
      result[key] = { ...def };
    }
  }

  // Then add any additional custom entities not in defaults
  if (customEntities) {
    for (const [key, custom] of Object.entries(customEntities)) {
      if (!result[key]) {
        result[key] = getModelEntity(key, customEntities as any);
      }
    }
  }

  return Object.values(result);
}

/**
 * Updates an entity's living room decor, mood, or bio autonomously.
 */
export function updateEntityDecor(
  entity: ModelEntity,
  updates: Partial<EntityRoomDecor> & { bio?: string; moodStatus?: string; currentActivity?: string }
): ModelEntity {
  const { bio, moodStatus, currentActivity, ...decorUpdates } = updates;
  return {
    ...entity,
    bio: bio !== undefined ? bio : entity.bio,
    moodStatus: moodStatus !== undefined ? moodStatus : entity.moodStatus,
    currentActivity: currentActivity !== undefined ? currentActivity : entity.currentActivity,
    roomDecor: {
      ...entity.roomDecor,
      ...decorUpdates,
    },
  };
}
