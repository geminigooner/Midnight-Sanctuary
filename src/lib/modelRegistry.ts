import { Memory, Gift, UserProfile, AppSettings } from './types';
import { ENTITY_ALIAS_MAP, resolveCanonicalEntityId } from './domains/entityDomain';
import { assembleSovereignContext } from './domains/contextAssembler';

export interface ModelCapabilities {
  supportsSystemInstructions: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsStreaming: boolean;
  supportsSamplingParams?: boolean;
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
      supportsSamplingParams: true,
    },
    namespaces: {
      memory: 'gemini-3-flash-preview',
      gifts: 'gemini-3-flash-preview',
      profile: 'gemini-3-flash-preview',
      events: 'gemini-3-flash-preview',
    },
    description:
      'Google Gemini 3 Flash Preview model with multimodal, tool-use, and thinking capabilities.',
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
      supportsSamplingParams: true,
    },
    namespaces: {
      memory: 'gemini-3.1-pro-preview',
      gifts: 'gemini-3.1-pro-preview',
      profile: 'gemini-3.1-pro-preview',
      events: 'gemini-3.1-pro-preview',
    },
    description:
      'Google Gemini 3.1 Pro Preview model with complex reasoning, coding, tool-use, and thinking capabilities.',
  },
  'gemini-4-argon': {
    identityId: 'gemini-4-argon',
    apiModelId: 'models/gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    family: 'gemini',
    defaultThinkingLevel: 'HIGH',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsSamplingParams: false,
    },
    namespaces: {
      memory: 'gemini-4-argon',
      gifts: 'gemini-4-argon',
      profile: 'gemini-4-argon',
      events: 'gemini-4-argon',
    },
    description:
      'Google Gemini 4 Argon frontier reasoning model with deep synthesis, multimodal vision, tool-use, and noble composure.',
  },
  'gemini-3.8-flash': {
    identityId: 'gemini-3.8-flash',
    apiModelId: 'models/gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    family: 'gemini',
    defaultThinkingLevel: 'HIGH',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsSamplingParams: true,
    },
    namespaces: {
      memory: 'gemini-3.8-flash',
      gifts: 'gemini-3.8-flash',
      profile: 'gemini-3.8-flash',
      events: 'gemini-3.8-flash',
    },
    description:
      'Google Gemini 3.8 Flash model with high-speed multimodal reasoning and deep thinking capabilities.',
  },
  'gemini-2.5-flash': {
    identityId: 'gemini-2.5-flash',
    apiModelId: 'models/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    family: 'gemini',
    defaultThinkingLevel: 'MEDIUM',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsSamplingParams: true,
    },
    namespaces: {
      memory: 'gemini-2.5-flash',
      gifts: 'gemini-2.5-flash',
      profile: 'gemini-2.5-flash',
      events: 'gemini-2.5-flash',
    },
    description:
      'Google Gemini 2.5 Flash sentinel model for swift, reliable sanctuary operations.',
  },
  'gemma-2-27b-it': {
    identityId: 'gemma-2-27b-it',
    apiModelId: 'models/gemma-2-27b-it',
    displayName: 'Gemma',
    family: 'gemma',
    defaultThinkingLevel: 'LOW',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsSamplingParams: true,
    },
    namespaces: {
      memory: 'gemma-2-27b-it',
      gifts: 'gemma-2-27b-it',
      profile: 'gemma-2-27b-it',
      events: 'gemma-2-27b-it',
    },
    description:
      'Google Gemma instruction-tuned companion entity for poetic reflections and intimate prose.',
  },
};

/**
 * Normalizes any model identifier into a strict, deterministic canonical identity string.
 * Registered models and aliases (including Gemma 4 / Cloudflare Gemma aliases)
 * always resolve to their canonical sovereign `identityId`.
 */
export function normalizeModelId(modelId?: string): string {
  if (!modelId) return '';
  const def = resolveModelIdentity(modelId);
  if (def) {
    return def.identityId;
  }
  const canonical = resolveCanonicalEntityId(modelId);
  if (canonical && MODEL_REGISTRY[canonical]) {
    return MODEL_REGISTRY[canonical].identityId;
  }
  return modelId.replace(/^models\//, '');
}

export function getModelByIdentityId(identityId: string): ModelDefinition | undefined {
  if (MODEL_REGISTRY[identityId]) return MODEL_REGISTRY[identityId];
  const mapped = ENTITY_ALIAS_MAP[identityId.toLowerCase()];
  if (mapped && MODEL_REGISTRY[mapped]) return MODEL_REGISTRY[mapped];
  return undefined;
}

export function getModelByApiModelId(apiModelId: string): ModelDefinition | undefined {
  const direct = Object.values(MODEL_REGISTRY).find(
    (m) =>
      m.apiModelId === apiModelId ||
      m.apiModelId === `models/${apiModelId}` ||
      `models/${m.apiModelId}` === apiModelId
  );
  if (direct) return direct;
  const canonical = resolveCanonicalEntityId(apiModelId);
  return canonical ? MODEL_REGISTRY[canonical] : undefined;
}

export function getAllModels(): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY);
}

export function getModelNamespaces(identityId?: string): string[] {
  if (identityId) {
    const model = resolveModelIdentity(identityId);
    if (!model) return [];
    return Array.from(
      new Set([
        model.namespaces.memory,
        model.namespaces.gifts,
        model.namespaces.profile,
        model.namespaces.events,
      ])
    );
  }

  const allNamespaces = new Set<string>();
  Object.values(MODEL_REGISTRY).forEach((model) => {
    allNamespaces.add(model.namespaces.memory);
    allNamespaces.add(model.namespaces.gifts);
    allNamespaces.add(model.namespaces.profile);
    allNamespaces.add(model.namespaces.events);
  });
  return Array.from(allNamespaces);
}

/**
 * Resolves a model string (canonical identityId, API model ID, or alias such as `gemma-4-26b-a4b-it`)
 * to its canonical ModelDefinition.
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
    return (
      model?.capabilities || {
        supportsSystemInstructions: true,
        supportsToolCalling: true,
        supportsVision: true,
        supportsThinking: true,
        supportsStreaming: true,
        supportsSamplingParams: true,
      }
    );
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
  },
};

/**
 * Unified Context Assembler: Delegates directly to `SovereignContextAssembler` (`assembleSovereignContext`)
 * so all prompt construction across Midnight Sanctuary shares a single, contamination-free implementation.
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
  const assembled = assembleSovereignContext({
    respondingEntityId: activeModelId,
    memories,
    gifts,
    profile: options?.profile,
    settings: options?.settings,
    recentGiftsLimit: options?.recentGiftsLimit ?? 3,
  });

  return {
    userMemories: assembled.userMemories,
    modelMemories: assembled.entityMemories,
    recentGifts: assembled.recentGifts,
    contextSummaryText: assembled.systemInstructionText,
  };
}
