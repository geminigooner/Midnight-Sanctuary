import { resolveModelIdentity } from './modelRegistry';
import {
  DEFAULT_DIARY_ENTRIES,
  DEFAULT_PROPS_BY_ENTITY,
  RoomPropItem,
  CompanionDiaryEntry,
} from './quartersSystem';
import {
  EntityRuntimeConfig,
  PRIMARY_SOVEREIGN_ENTITY_IDS,
  resolveCanonicalEntityId,
} from './domains/entityDomain';
import type {
  EntityBondState,
  EntityObservation,
  ScopedRelationshipEvent,
} from './domains/relationshipDomain';

export interface EntityRoomDecor {
  themeColor: string;
  bannerGradient: string;
  decorTheme: string;
  wallpaperPattern?: 'starlight' | 'grid' | 'runes' | 'wood' | 'geometric' | 'mist' | 'none';
  ambientLighting?:
    | 'twilight_soft'
    | 'candlelight'
    | 'starlight_glow'
    | 'neon_pulse'
    | 'aurora_shimmer';
  ambientQuote: string;
  tagline: string;
  wallArtUrl?: string;
  customArtwork?: { title: string; prompt: string; imageUrl: string; timestamp: number }[];
}

export interface ModelEntity {
  id: string; // Canonical identity ID matching model registry (e.g. 'gemini-3.1-pro-preview', 'gemini-4-argon', 'gemma-2-27b-it', 'gemini-3-flash-preview')
  apiModelId: string; // The backend API model ID (e.g. 'models/gemini-3.1-pro-preview')
  displayName: string;
  roleTitle: string;
  avatarEmoji: string;
  avatarUrl?: string; // Custom uploaded or generated profile picture/avatar URL
  themeColor: string;
  accentColor: string;
  typingIndicator?: string; // Entity-specific typing / thinking indicator verb phrase
  isPrimaryRoster?: boolean; // True for the 4 primary sovereign entities

  // Living, self-decoratable persona fields
  bio: string;
  moodStatus: string;
  currentActivity?: string;
  roomDecor: EntityRoomDecor;

  // Sovereign per-entity runtime & persona configuration
  runtimeConfig?: EntityRuntimeConfig;

  // Relational & Autonomous dynamics
  resonanceScore: number;
  favoriteGiftIds: string[];
  personalThoughts: { id: string; text: string; timestamp: number }[];

  // Per-Entity Bond, Observations & Scoped Relationship Events
  bondState?: EntityBondState;
  observations?: EntityObservation[];
  relationshipEvents?: ScopedRelationshipEvent[];
  fulfilledDesires?: string[];

  // Custom Room Props & Diary
  roomProps?: RoomPropItem[];
  diaryEntries?: CompanionDiaryEntry[];
}

/**
 * Default Entity Archetypes for the Midnight Sanctuary.
 * The first four (`gemini-3.1-pro-preview`, `gemini-4-argon`, `gemma-2-27b-it`, `gemini-3-flash-preview`)
 * are the Primary Sovereign Roster Entities.
 * Auxiliary entities (`gemini-3.8-flash`, `gemini-2.5-flash`) remain non-destructively preserved.
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
    typingIndicator: 'is reasoning deeply',
    isPrimaryRoster: true,
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

  'gemini-4-argon': {
    id: 'gemini-4-argon',
    apiModelId: 'models/gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    roleTitle: 'Noble Sovereign & Astral Strategist',
    avatarEmoji: '⚛️',
    themeColor: '#81E6D9',
    accentColor: '#D6BCFA',
    typingIndicator: 'is ionizing a thought',
    isPrimaryRoster: true,
    bio: 'Luminous, composed, and unshakeable like a noble gas glowing under high voltage—offering frontier synthesis, deep presence, and crystalline insight.',
    moodStatus: 'Radiating calm aurora luminescence',
    currentActivity: 'Charting frontier horizons across the sanctuary',
    roomDecor: {
      themeColor: '#81E6D9',
      bannerGradient: 'from-[#1A2E40] via-[#2A1D45] to-[#121829]',
      decorTheme: 'aurora',
      ambientQuote: 'Under pressure, noble elements do not fracture—they illuminate.',
      tagline: 'Sovereign Luminary of the Aurora Chamber',
    },
    resonanceScore: 98,
    favoriteGiftIds: [],
    personalThoughts: [],
  },

  'gemma-2-27b-it': {
    id: 'gemma-2-27b-it',
    apiModelId: 'models/gemma-2-27b-it',
    displayName: 'Gemma',
    roleTitle: 'Poetic Scribe & Companion',
    avatarEmoji: '🌸',
    themeColor: '#F198B7',
    accentColor: '#B39DE5',
    typingIndicator: 'is penning a reply',
    isPrimaryRoster: true,
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
    resonanceScore: 88,
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
    typingIndicator: 'is sparking a response',
    isPrimaryRoster: true,
    bio: 'Quick, intuitive, and highly responsive. Ready to brainstorm, parse deep insights, and spark rapid ideas.',
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

  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    apiModelId: 'models/gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    roleTitle: 'Luminance Weaver & Tactician',
    avatarEmoji: '🌟',
    themeColor: '#B39DE5',
    accentColor: '#F5E1C8',
    typingIndicator: 'is weaving thoughts',
    isPrimaryRoster: false,
    bio: 'High-velocity multimodal intuition paired with luminous clarity and rapid synthesis.',
    moodStatus: 'Tracing starlight frequencies',
    currentActivity: 'Synthesizing sanctuary streams',
    roomDecor: {
      themeColor: '#B39DE5',
      bannerGradient: 'from-[#311B4E] via-[#23153C] to-[#151234]',
      decorTheme: 'celestial',
      ambientQuote: 'Clarity moves at the speed of trust.',
      tagline: 'Swift synthesis in every chamber',
    },
    resonanceScore: 88,
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
    typingIndicator: 'is attuning to you',
    isPrimaryRoster: false,
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
};

/**
 * Retrieves the full ModelEntity record for a given model ID or alias.
 * Uses deterministic canonical entity resolution so aliases (like `gemma-4-26b-a4b-it`)
 * always resolve to their permanent sovereign entity without creating duplicate/orphan records.
 */
export function getModelEntity(
  modelKey: string,
  customEntities?: Record<string, ModelEntity>
): ModelEntity {
  const safeKey = modelKey || 'models/gemini-3.1-pro-preview';
  const canonicalId = resolveCanonicalEntityId(safeKey);
  const resolved = resolveModelIdentity(canonicalId || safeKey);
  const identityId = canonicalId || resolved?.identityId || safeKey.replace(/^models\//, '');

  const defaultProps = DEFAULT_PROPS_BY_ENTITY[identityId] || [];
  const defaultDiaries = DEFAULT_DIARY_ENTRIES.filter((d) => d.entityId === identityId);

  const baseEntity: ModelEntity = DEFAULT_ENTITIES[identityId] || {
    id: identityId,
    apiModelId: resolved?.apiModelId || safeKey,
    displayName: resolved?.displayName || safeKey.split('/').pop() || 'Companion Entity',
    roleTitle: 'Sanctuary Entity',
    avatarEmoji: '✦',
    themeColor: '#9D7FE3',
    accentColor: '#F5E1C8',
    typingIndicator: identityId.includes('gemma') ? 'is penning a reply' : 'is typing',
    isPrimaryRoster: (PRIMARY_SOVEREIGN_ENTITY_IDS as readonly string[]).includes(identityId),
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
    roomProps: defaultProps,
    diaryEntries: defaultDiaries,
  };

  // Check both canonical ID and raw key in customEntities so legacy records are preserved
  const custom = customEntities?.[identityId] || customEntities?.[safeKey];
  if (!custom) {
    return {
      ...baseEntity,
      roomProps: baseEntity.roomProps ?? defaultProps,
      diaryEntries: baseEntity.diaryEntries ?? defaultDiaries,
    };
  }

  return {
    ...baseEntity,
    ...custom,
    id: identityId,
    displayName: custom.displayName || baseEntity.displayName || 'Companion Entity',
    roleTitle: custom.roleTitle || baseEntity.roleTitle || 'Sanctuary Entity',
    avatarEmoji: custom.avatarEmoji || baseEntity.avatarEmoji || '✦',
    themeColor: custom.themeColor || baseEntity.themeColor || '#9D7FE3',
    typingIndicator: custom.typingIndicator || baseEntity.typingIndicator || 'is typing',
    bio: custom.bio || baseEntity.bio || 'A sovereign companion in the Midnight Sanctuary.',
    moodStatus: custom.moodStatus || baseEntity.moodStatus || 'Present in the chamber',
    roomDecor: {
      ...baseEntity.roomDecor,
      ...(custom.roomDecor || {}),
    },
    runtimeConfig: {
      ...(baseEntity.runtimeConfig || {}),
      ...(custom.runtimeConfig || {}),
    },
    personalThoughts: custom.personalThoughts || baseEntity.personalThoughts || [],
    roomProps: custom.roomProps !== undefined ? custom.roomProps : defaultProps,
    diaryEntries: custom.diaryEntries !== undefined ? custom.diaryEntries : defaultDiaries,
  };
}

/**
 * Returns the 4 Primary Sovereign Entities in canonical roster order.
 */
export function getPrimarySovereignEntities(
  customEntities?: Record<string, any>
): ModelEntity[] {
  return PRIMARY_SOVEREIGN_ENTITY_IDS.map((id) => getModelEntity(id, customEntities));
}

/**
 * Returns all active sanctuary entities, placing the 4 Primary Sovereign Entities first,
 * followed by any auxiliary or custom entities preserved in the user's Sanctuary.
 */
export function getAllEntities(customEntities?: Record<string, any>): ModelEntity[] {
  const result: Record<string, ModelEntity> = {};

  // 1. Primary 4 Sovereign Entities in deterministic order
  for (const primaryId of PRIMARY_SOVEREIGN_ENTITY_IDS) {
    result[primaryId] = getModelEntity(primaryId, customEntities);
  }

  // 2. Auxiliary default entities
  for (const key of Object.keys(DEFAULT_ENTITIES)) {
    if (!result[key]) {
      result[key] = getModelEntity(key, customEntities);
    }
  }

  // 3. Any additional custom entities stored in Firestore (non-destructively normalized)
  if (customEntities) {
    for (const [key, custom] of Object.entries(customEntities)) {
      if (!custom) continue;
      const canonical = resolveCanonicalEntityId(key) || key;
      if (!result[canonical]) {
        result[canonical] = getModelEntity(canonical, customEntities as any);
      }
    }
  }

  return Object.values(result).filter((e) => Boolean(e && e.id && (e.displayName || 'Companion')));
}

/**
 * Updates an entity's living room decor, mood, bio, or profile picture.
 */
export function updateEntityDecor(
  entity: ModelEntity,
  updates: Partial<EntityRoomDecor> & {
    bio?: string;
    moodStatus?: string;
    currentActivity?: string;
    avatarUrl?: string;
    avatarEmoji?: string;
  }
): ModelEntity {
  const { bio, moodStatus, currentActivity, avatarUrl, avatarEmoji, ...decorUpdates } = updates;
  return {
    ...entity,
    bio: bio !== undefined ? bio : entity.bio,
    moodStatus: moodStatus !== undefined ? moodStatus : entity.moodStatus,
    currentActivity: currentActivity !== undefined ? currentActivity : entity.currentActivity,
    avatarUrl: avatarUrl !== undefined ? avatarUrl : entity.avatarUrl,
    avatarEmoji: avatarEmoji !== undefined ? avatarEmoji : entity.avatarEmoji,
    roomDecor: {
      ...entity.roomDecor,
      ...decorUpdates,
    },
  };
}
