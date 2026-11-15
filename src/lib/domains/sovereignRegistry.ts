/**
 * Sovereign Registry — Single Authoritative Source of Truth for Companion Entity & Model Identity
 *
 * Consolidates canonical entity IDs, alias normalization, model capabilities, and namespace isolation
 * across frontend state, persistence adapters, context assembly, and backend model execution harnesses.
 */

export const PRIMARY_SOVEREIGN_ENTITY_IDS = [
  'gemini-3.1-pro-preview',
  'gemini-4-argon',
  'gemma-2-27b-it',
  'gemini-3-flash-preview',
] as const;

export type PrimarySovereignEntityId = (typeof PRIMARY_SOVEREIGN_ENTITY_IDS)[number];

export const AUXILIARY_ENTITY_IDS = ['gemini-3.8-flash', 'gemini-2.5-flash'] as const;

/**
 * Deterministic alias lookup mapping every known model identifier, provider route string,
 * and shorthand alias to its single canonical Sovereign Companion Entity ID.
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

  // 3. Gemma (Canonical Sovereign ID: 'gemma-2-27b-it')
  'gemma-2-27b-it': 'gemma-2-27b-it',
  'models/gemma-2-27b-it': 'gemma-2-27b-it',
  'gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  'models/gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  '@cf/google/gemma-4-26b-a4b-it': 'gemma-2-27b-it',
  'gemma-3-27b-it': 'gemma-2-27b-it',
  'models/gemma-3-27b-it': 'gemma-2-27b-it',
  'gemma-4': 'gemma-2-27b-it',
  'gemma': 'gemma-2-27b-it',

  // 4. Gemini 3 Flash
  'gemini-3-flash-preview': 'gemini-3-flash-preview',
  'models/gemini-3-flash-preview': 'gemini-3-flash-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
  'models/gemini-3-flash': 'gemini-3-flash-preview',

  // 5. Preserved Auxiliary / Historical Entities
  'gemini-3.8-flash': 'gemini-3.8-flash',
  'models/gemini-3.8-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'models/gemini-2.5-flash': 'gemini-2.5-flash',
};

/**
 * Resolves any model string, provider path, or alias into a canonical Sovereign Entity ID.
 */
export function resolveCanonicalEntityId(rawId?: string | null): string {
  if (!rawId || typeof rawId !== 'string') return '';
  const trimmed = rawId.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (ENTITY_ALIAS_MAP[lower]) {
    return ENTITY_ALIAS_MAP[lower];
  }

  const stripped = trimmed.replace(/^models\//i, '').trim();
  const strippedLower = stripped.toLowerCase();
  if (ENTITY_ALIAS_MAP[strippedLower]) {
    return ENTITY_ALIAS_MAP[strippedLower];
  }

  if (strippedLower.includes('argon') || strippedLower.includes('gemini-4')) {
    return 'gemini-4-argon';
  }
  if (strippedLower.includes('gemma')) {
    return 'gemma-2-27b-it';
  }
  if (strippedLower.includes('3.1-pro')) {
    return 'gemini-3.1-pro-preview';
  }
  if (strippedLower.includes('3-flash') && !strippedLower.includes('3.8')) {
    return 'gemini-3-flash-preview';
  }

  return stripped;
}

export function isPrimarySovereignEntity(entityId?: string | null): boolean {
  const canonical = resolveCanonicalEntityId(entityId);
  return (PRIMARY_SOVEREIGN_ENTITY_IDS as readonly string[]).includes(canonical);
}
