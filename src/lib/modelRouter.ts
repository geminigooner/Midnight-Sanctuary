import { resolveModelIdentity } from './modelRegistry';

export type ModelProvider = 'gemini_legacy' | 'cloudflare_gemma' | 'gemini_standard';

export interface RouteResolution {
  provider: ModelProvider;
  keyEnvName: 'GEMINI_LEGACY_API_KEY' | 'CF_TOKEN' | 'GEMINI_API_KEY' | 'GENAI_API_KEY';
  targetModel: string;
  isGemma: boolean;
  isGemini3Preview: boolean;
}

/**
 * Resolves the exact routing strategy and provider for any given model string:
 * 
 * 1. Flash 3 & Gemini Pro 3.1: Routed strictly through `GEMINI_LEGACY_API_KEY`
 * 2. Gemma models: Routed primarily through Cloudflare Workers AI using `CF_TOKEN`, with direct Gemini API fallback
 * 3. Other Gemini models: Routed through `GEMINI_API_KEY` (or `GENAI_API_KEY`)
 * 
 * Strictly throws genuine errors if endpoints fail, without masked or unwanted 2.5 fallbacks.
 */
export function resolveModelRoute(modelKey: string): RouteResolution {
  const normalized = modelKey.toLowerCase();
  const isGemma = normalized.includes('gemma');

  // 1. Gemini 3.1 Pro & Gemini 3 Flash -> GEMINI_LEGACY_API_KEY
  if (normalized.includes('gemini-3.1-pro') || normalized.includes('gemini-3-flash') || normalized.includes('3.1-pro') || normalized.includes('3-flash')) {
    return {
      provider: 'gemini_legacy',
      keyEnvName: 'GEMINI_LEGACY_API_KEY',
      targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
      isGemma: false,
      isGemini3Preview: true,
    };
  }

  // 2. Gemma models -> Cloudflare (CF_TOKEN) primary
  if (isGemma) {
    return {
      provider: 'cloudflare_gemma',
      keyEnvName: 'CF_TOKEN',
      targetModel: modelKey,
      isGemma: true,
      isGemini3Preview: false,
    };
  }

  // 3. Other Gemini models -> GEMINI_API_KEY (or GENAI_API_KEY fallback)
  return {
    provider: 'gemini_standard',
    keyEnvName: 'GEMINI_API_KEY',
    targetModel: modelKey.startsWith('models/') ? modelKey : `models/${modelKey}`,
    isGemma: false,
    isGemini3Preview: false,
  };
}
