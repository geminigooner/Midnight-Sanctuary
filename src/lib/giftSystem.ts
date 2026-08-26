import { Gift } from './types';
import { resolveModelIdentity, normalizeModelId } from './modelSystem';

/**
 * Normalizes a model identifier string to a canonical identity string if registered,
 * or standardizes the raw string.
 */
export function normalizeModelNamespace(modelId?: string): string {
  if (!modelId) return 'unknown';
  const def = resolveModelIdentity(modelId);
  if (def) {
    return def.namespaces.gifts || def.identityId;
  }
  return normalizeModelId(modelId) || 'unknown';
}

/**
 * Checks if a gift was given by the user to a specific model.
 */
export function isUserGiftForModel(gift: Gift, currentModelId: string): boolean {
  if (gift.from !== 'user') return false;
  // If targetModelId is explicitly set, check matching namespace
  if (gift.targetModelId) {
    return normalizeModelNamespace(gift.targetModelId) === normalizeModelNamespace(currentModelId);
  }
  // If modelId is set on user gift, check matching namespace
  if (gift.modelId) {
    return normalizeModelNamespace(gift.modelId) === normalizeModelNamespace(currentModelId);
  }
  // Unscoped user gift (legacy) - treat as user gift
  return false;
}

/**
 * Checks if a gift was received from a specific model.
 */
export function isGiftFromModel(gift: Gift, currentModelId: string): boolean {
  if (gift.from === 'user') return false;
  const giftModel = gift.modelId || gift.from;
  return normalizeModelNamespace(giftModel) === normalizeModelNamespace(currentModelId);
}

/**
 * Selects all gifts strictly visible to the specified active model:
 * 1. Gifts from this specific model to the user
 * 2. Gifts from the user addressed to this specific model
 */
export function getModelVisibleGifts(gifts: Gift[], currentModelId: string): Gift[] {
  const currentNamespace = normalizeModelNamespace(currentModelId);
  return (gifts || []).filter(g => {
    // Model-authored gift
    if (g.from !== 'user') {
      const giftModel = g.modelId || g.from;
      return normalizeModelNamespace(giftModel) === currentNamespace;
    }
    // User-authored gift
    const targetModel = g.targetModelId || g.modelId;
    if (targetModel) {
      return normalizeModelNamespace(targetModel) === currentNamespace;
    }
    // Legacy gifts without targetModelId: only visible if fallback matches or as legacy
    return false;
  });
}

/**
 * Selects all gifts given to or received by a specific model (for UI archives).
 */
export function getGiftsForModelArchive(gifts: Gift[], currentModelId: string): Gift[] {
  return getModelVisibleGifts(gifts, currentModelId);
}

/**
 * Selects legacy or unassigned gifts that don't belong to the current active model.
 */
export function getLegacyOrOtherModelGifts(gifts: Gift[], currentModelId: string): Gift[] {
  const currentNamespace = normalizeModelNamespace(currentModelId);
  return (gifts || []).filter(g => {
    const giftModel = g.from === 'user' ? (g.targetModelId || g.modelId) : (g.modelId || g.from);
    if (!giftModel) return true; // Truly unassigned
    return normalizeModelNamespace(giftModel) !== currentNamespace;
  });
}
