import { ModelCapabilities, ModelDefinition, MODEL_REGISTRY } from '../modelRegistry';

/**
 * The four permanent Primary Sovereign Companion Entities of Midnight Sanctuary.
 * Each is a distinct, first-class entity with its own permanent identity,
 * model association, private memories, gifts, relationship bond, and settings.
 */
export const PRIMARY_SOVEREIGN_ENTITY_IDS = [
  'gemini-3.1-pro-preview',
  'gemini-4-argon',
  'gemma-2-27b-it',
  'gemini-3-flash-preview',
] as const;

export type PrimarySovereignEntityId = (typeof PRIMARY_SOVEREIGN_ENTITY_IDS)[number];

/**
 * Preserved archive/auxiliary entity IDs that remain non-destructively supported
 * for historical conversations and records.
 */
export const AUXILIARY_ENTITY_IDS = ['gemini-3.8-flash', 'gemini-2.5-flash'] as const;

/**
 * Canonical alias map ensuring every model string, API identifier, or provider alias
 * resolves deterministically to the single permanent sovereign entity ID without
 * ever splitting or overwriting existing Firestore documents.
 */
export const ENTITY_ALIAS_MAP: Record<string, string> = {
  // 1. Gemini 3.1 Pro
  'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
  'models/gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'models/gemini-3.1-pro': 'gemini-3.1-pro-preview',

  // 2. Gemini 4 Argon
  'gemini-4-argon': 'gemini-4-argon',
  'models/gemini-4-argon': 'gemini-4-argon',
  'gemini-4': 'gemini-4-argon',
  'models/gemini-4': 'gemini-4-argon',
  'argon': 'gemini-4-argon',

  // 3. Gemma (Sovereign entity key preserved as 'gemma-2-27b-it' for Firestore continuity)
  'gemma-2-27b-it': 'gemma-2-27b-it',
  'models/gemma-2-27b-it': 'gemma-2-27b-it',
  'gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  'models/gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  '@cf/google/gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  'gemma-4': 'gemma-2-27b-it',
  'models/gemma-4': 'gemma-2-27b-it',
  'gemma': 'gemma-2-27b-it',

  // 4. Gemini 3 Flash
  'gemini-3-flash-preview': 'gemini-3-flash-preview',
  'models/gemini-3-flash-preview': 'gemini-3-flash-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
  'models/gemini-3-flash': 'gemini-3-flash-preview',

  // Auxiliary / Archive Entities (preserved non-destructively)
  'gemini-3.8-flash': 'gemini-3.8-flash',
  'models/gemini-3.8-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'models/gemini-2.5-flash': 'gemini-2.5-flash',
};

/**
 * Per-entity sovereign runtime and persona configuration.
 * Allows each companion entity to retain its own custom system instruction and sampling settings
 * without overwriting other entities' configurations.
 */
export interface EntityRuntimeConfig {
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  includeThoughts?: boolean;
  forceCloudflare?: boolean;
}

/**
 * Resolves any raw model string, provider model name, or entity key into its
 * canonical sovereign `entityId`.
 * Never returns a `models/` prefix for known or unknown IDs.
 */
export function resolveCanonicalEntityId(rawId?: string | null): string {
  if (!rawId || typeof rawId !== 'string') return '';
  const trimmed = rawId.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (ENTITY_ALIAS_MAP[lower]) {
    return ENTITY_ALIAS_MAP[lower];
  }

  const stripped = lower.replace(/^models\//, '').replace(/^@cf\/google\//, '');
  if (ENTITY_ALIAS_MAP[stripped]) {
    return ENTITY_ALIAS_MAP[stripped];
  }

  // Substring safety net for Gemma variants so Gemma never fragments
  if (stripped.includes('gemma')) {
    return 'gemma-2-27b-it';
  }
  if (stripped.includes('argon')) {
    return 'gemini-4-argon';
  }

  return trimmed.replace(/^models\//, '');
}

/**
 * Checks whether an entity ID belongs to the 4 primary sovereign roster entities.
 */
export function isPrimarySovereignEntity(entityId?: string | null): boolean {
  const canonical = resolveCanonicalEntityId(entityId);
  return (PRIMARY_SOVEREIGN_ENTITY_IDS as readonly string[]).includes(canonical);
}

/**
 * Resolves the ModelDefinition for any model or entity alias.
 */
export function resolveEntityModelDefinition(modelOrEntityId?: string | null): ModelDefinition | undefined {
  const canonical = resolveCanonicalEntityId(modelOrEntityId);
  if (!canonical) return undefined;
  return MODEL_REGISTRY[canonical];
}

/**
 * Returns capabilities for the given entity or model identifier.
 */
export function getEntityCapabilities(modelOrEntityId?: string | null): ModelCapabilities {
  const def = resolveEntityModelDefinition(modelOrEntityId);
  return (
    def?.capabilities || {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsSamplingParams: true,
    }
  );
}
