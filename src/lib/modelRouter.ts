import { resolveModelIdentity } from './modelRegistry';

export type ModelProvider = 'gemini_pro' | 'gemini_legacy' | 'cloudflare_gemma' | 'gemini_standard';

export interface RouteResolution {
  provider: ModelProvider;
  keyEnvName:
    | 'PRO_API_KEY'
    | 'GEMINI_LEGACY_API_KEY'
    | 'LEGACY_API_KEY'
    | 'CF_TOKEN'
    | 'GEMINI_API_KEY'
    | 'GENAI_API_KEY';
  targetModel: string;
  isGemma: boolean;
  isGemini3Preview: boolean;
}

/**
 * Resolves the exact routing strategy and provider for any given model string:
 *
 * 1. Gemini 4 Argon: Routed through `LEGACY_API_KEY` / `GEMINI_LEGACY_API_KEY` if present, otherwise `PRO_API_KEY`
 * 2. Gemini Pro 3.1: Routed strictly through `PRO_API_KEY`
 * 3. Flash 3 / 3.8: Routed through `GEMINI_LEGACY_API_KEY`
 * 4. Gemma models: Routed primarily through Cloudflare Workers AI using `CF_TOKEN`, with direct Gemini API fallback
 * 5. Other Gemini models: Routed through `GEMINI_API_KEY` (or `GENAI_API_KEY`)
 */
export function resolveModelRoute(modelKey: string): RouteResolution {
  const normalized = (modelKey || '').toLowerCase();
  const isGemma = normalized.includes('gemma');

  // 1. Gemini 4 Argon -> LEGACY_API_KEY / GEMINI_LEGACY_API_KEY if configured, otherwise PRO_API_KEY
  if (normalized.includes('argon') || normalized.includes('gemini-4')) {
    const hasLegacyKey =
      typeof process !== 'undefined' &&
      process.env &&
      Boolean(
        (process.env.LEGACY_API_KEY && process.env.LEGACY_API_KEY.trim()) ||
          (process.env.GEMINI_LEGACY_API_KEY && process.env.GEMINI_LEGACY_API_KEY.trim())
      );
    const chosenEnvKey =
      typeof process !== 'undefined' &&
      process.env?.LEGACY_API_KEY &&
      process.env.LEGACY_API_KEY.trim()
        ? 'LEGACY_API_KEY'
        : hasLegacyKey
        ? 'GEMINI_LEGACY_API_KEY'
        : 'PRO_API_KEY';

    return {
      provider: hasLegacyKey ? 'gemini_legacy' : 'gemini_pro',
      keyEnvName: chosenEnvKey,
      targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
      isGemma: false,
      isGemini3Preview: true,
    };
  }

  // 2. Gemini 3.1 Pro -> PRO_API_KEY
  if (normalized.includes('gemini-3.1-pro') || normalized.includes('3.1-pro')) {
    return {
      provider: 'gemini_pro',
      keyEnvName: 'PRO_API_KEY',
      targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
      isGemma: false,
      isGemini3Preview: true,
    };
  }

  // 3. Gemini 3 Flash / 3.8 Flash -> GEMINI_LEGACY_API_KEY
  if (
    normalized.includes('gemini-3-flash') ||
    normalized.includes('3-flash') ||
    normalized.includes('3.8-flash') ||
    normalized.includes('gemini-3.8')
  ) {
    return {
      provider: 'gemini_legacy',
      keyEnvName: 'GEMINI_LEGACY_API_KEY',
      targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
      isGemma: false,
      isGemini3Preview: true,
    };
  }

  // 4. Gemma models -> Cloudflare (CF_TOKEN) primary
  if (isGemma) {
    return {
      provider: 'cloudflare_gemma',
      keyEnvName: 'CF_TOKEN',
      targetModel: modelKey,
      isGemma: true,
      isGemini3Preview: false,
    };
  }

  // 5. Other Gemini models -> GEMINI_API_KEY (or GENAI_API_KEY fallback)
  return {
    provider: 'gemini_standard',
    keyEnvName: 'GEMINI_API_KEY',
    targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
    isGemma: false,
    isGemini3Preview: false,
  };
}
