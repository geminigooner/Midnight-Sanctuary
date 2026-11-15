import { ModelCapabilities, ModelDefinition, MODEL_REGISTRY } from '../modelRegistry';
import {
  AUXILIARY_ENTITY_IDS,
  ENTITY_ALIAS_MAP,
  isPrimarySovereignEntity,
  PRIMARY_SOVEREIGN_ENTITY_IDS,
  type PrimarySovereignEntityId,
  resolveCanonicalEntityId,
} from './sovereignRegistry';

export {
  PRIMARY_SOVEREIGN_ENTITY_IDS,
  type PrimarySovereignEntityId,
  AUXILIARY_ENTITY_IDS,
  ENTITY_ALIAS_MAP,
  resolveCanonicalEntityId,
  isPrimarySovereignEntity,
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
