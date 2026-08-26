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
  identityId: string; // The canonical internal unique ID
  apiModelId: string; // The exact API model ID used by the provider
  displayName: string;
  family: string;
  capabilities: ModelCapabilities;
  namespaces: ModelNamespaces;
  description?: string;
}

export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  'gemini-3-flash-preview': {
    identityId: 'gemini-3-flash-preview',
    apiModelId: 'models/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    family: 'gemini',
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
 * Returns undefined if the model is not registered.
 * Does not alter outgoing model strings or lookup behavior.
 */
export function resolveModelIdentity(modelString?: string): ModelDefinition | undefined {
  if (!modelString) return undefined;
  return getModelByIdentityId(modelString) || getModelByApiModelId(modelString);
}

/**
 * Normalizes any model identifier into a strict, deterministic canonical string ID.
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
