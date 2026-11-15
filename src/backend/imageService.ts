import { GoogleGenAI } from '@google/genai';
import { generateProceduralSanctuaryArt } from '../lib/media/proceduralArt';

export interface ImageGenerationOptions {
  prompt: string;
  model?:
    | '@cf/black-forest-labs/flux-1-schnell'
    | '@cf/black-forest-labs/flux-2-klein-4b'
    | '@cf/black-forest-flux-2-klein-9b'
    | 'gemini-image'
    | 'imagen-3'
    | 'imagen-4'
    | 'flux-klein'
    | string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
  steps?: number;
  respondingEntityId?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl: string; // Base64 data URL or external CDN URL
  provider: 'cloudflare-flux' | 'google-genai' | 'procedural-fallback';
  modelUsed: string;
  prompt: string;
  error?: string;
}

/**
 * Dual-Engine Image Generation Service with Entity-Aware Routing & Automatic Fallback
 * - For Gemma (`gemma-2-27b-it`) or explicit Flux requests: prioritizes Cloudflare Workers AI (Flux 1 Schnell / Flux 2 Klein), then falls back to Google GenAI (Gemini Image / Imagen), then procedural art.
 * - For Gemini entities (`gemini-3.1-pro-preview`, `gemini-4-argon`, `gemini-3-flash-preview`) or explicit Gemini/Imagen requests: prioritizes Google GenAI (`gemini-2.5-flash-image` / `imagen-3.0-generate-002`) when `gemini-image` or `imagen-*` is requested, and cascades across Cloudflare Flux + Google GenAI seamlessly.
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { prompt, model, aspectRatio = '1:1', steps = 4, respondingEntityId } = options;

  const modelLower = (model || '').toLowerCase();
  const entityLower = (respondingEntityId || '').toLowerCase();
  const isGemmaEntity = entityLower.includes('gemma');
  const preferGoogleFirst =
    !isGemmaEntity &&
    (modelLower.includes('gemini') || modelLower.includes('imagen'));

  const tryCloudflareFlux = async (): Promise<ImageGenerationResult | null> => {
    const cfToken =
      process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CF_TOKEN ||
      process.env.CF_API_TOKEN ||
      process.env.FLUX_API_KEY;
    const cfAccountId =
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CF_ACCOUNT_ID ||
      'e229f5ebdaabbb5edcdba4aa8cfe9fa2';
    const cfWorkerUrl = process.env.CLOUDFLARE_WORKER_URL || process.env.FLUX_API_URL;

    const targetFluxModel =
      model && model.includes('@cf/')
        ? model
        : modelLower.includes('klein')
        ? '@cf/black-forest-labs/flux-2-klein-4b'
        : '@cf/black-forest-labs/flux-1-schnell';

    if (cfWorkerUrl) {
      try {
        const res = await fetch(cfWorkerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfToken ? { Authorization: `Bearer ${cfToken}` } : {}),
          },
          body: JSON.stringify({
            prompt,
            model: targetFluxModel,
            steps,
            aspectRatio,
          }),
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('image/')) {
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = contentType || 'image/png';
            return {
              success: true,
              imageUrl: `data:${mimeType};base64,${base64}`,
              provider: 'cloudflare-flux',
              modelUsed: targetFluxModel,
              prompt,
            };
          } else {
            const data: any = await res.json();
            if (data.imageUrl || data.image || data.result) {
              const url =
                data.imageUrl ||
                data.image ||
                (typeof data.result === 'string' ? data.result : data.result?.image);
              if (url) {
                return {
                  success: true,
                  imageUrl:
                    url.startsWith('data:') || url.startsWith('http')
                      ? url
                      : `data:image/png;base64,${url}`,
                  provider: 'cloudflare-flux',
                  modelUsed: targetFluxModel,
                  prompt,
                };
              }
            }
          }
        }
      } catch (cfWorkerErr: any) {
        console.warn(
          '[ImageService] Custom CF Worker generation failed, attempting direct CF API or Gemini fallback:',
          cfWorkerErr.message
        );
      }
    }

    if (cfToken && cfAccountId) {
      try {
        const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${targetFluxModel}`;
        const cfRes = await fetch(cfApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            num_steps: steps,
          }),
        });

        if (cfRes.ok) {
          const contentType = cfRes.headers.get('content-type') || '';
          if (contentType.includes('image/')) {
            const arrayBuffer = await cfRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return {
              success: true,
              imageUrl: `data:${contentType};base64,${base64}`,
              provider: 'cloudflare-flux',
              modelUsed: targetFluxModel,
              prompt,
            };
          } else {
            const jsonRes: any = await cfRes.json();
            if (jsonRes.result?.image) {
              return {
                success: true,
                imageUrl: `data:image/png;base64,${jsonRes.result.image}`,
                provider: 'cloudflare-flux',
                modelUsed: targetFluxModel,
                prompt,
              };
            }
          }
        }
      } catch (cfErr: any) {
        console.warn('[ImageService] Cloudflare Workers AI direct API failed:', cfErr.message);
      }
    }

    return null;
  };

  const tryGoogleGenAI = async (): Promise<ImageGenerationResult | null> => {
    const candidateKeys = Array.from(
      new Set(
        [
          process.env.GEMINI_LEGACY_API_KEY,
          process.env.LEGACY_API_KEY,
          process.env.PRO_API_KEY,
          process.env.GENAI_API_KEY,
          process.env.GEMINI_API_KEY,
          process.env.API_KEY,
          process.env.GOOGLE_API_KEY,
          process.env.GEMINI_BACKUP_API_KEY,
        ]
          .filter((k): k is string => Boolean(k && k.trim() !== ''))
          .map((k) => k.trim())
      )
    );

    if (candidateKeys.length === 0) return null;

    const normalizedRatio =
      aspectRatio === '16:9'
        ? '16:9'
        : aspectRatio === '9:16'
        ? '9:16'
        : aspectRatio === '4:3'
        ? '4:3'
        : aspectRatio === '3:4'
        ? '3:4'
        : '1:1';

    for (const apiKey of candidateKeys) {
      const ai = new GoogleGenAI({ apiKey });

      // 1. Try Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) via generateContent
      try {
        const geminiImgResp = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: normalizedRatio,
            },
          } as any,
        });

        const parts = geminiImgResp.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            return {
              success: true,
              imageUrl: `data:${mime};base64,${part.inlineData.data}`,
              provider: 'google-genai',
              modelUsed: 'gemini-2.5-flash-image',
              prompt,
            };
          }
        }
      } catch {
        // Proceed to Imagen fallback
      }

      // 2. Try Imagen 3 (`imagen-3.0-generate-002`) via generateImages
      try {
        const response = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: normalizedRatio,
          },
        });

        const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64Image) {
          return {
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
            provider: 'google-genai',
            modelUsed: 'imagen-3.0-generate-002',
            prompt,
          };
        }
      } catch {
        // Try next key
      }
    }

    return null;
  };

  if (preferGoogleFirst) {
    const googleRes = await tryGoogleGenAI();
    if (googleRes) return googleRes;
    const cfRes = await tryCloudflareFlux();
    if (cfRes) return cfRes;
  } else {
    const cfRes = await tryCloudflareFlux();
    if (cfRes) return cfRes;
    const googleRes = await tryGoogleGenAI();
    if (googleRes) return googleRes;
  }

  // 3. Graceful Procedural / Atmospheric Visual Fallback
  const fallbackUrl = generateProceduralSanctuaryArt(prompt, respondingEntityId);

  return {
    success: true,
    imageUrl: fallbackUrl,
    provider: 'procedural-fallback',
    modelUsed: 'atmospheric-procedural',
    prompt,
    error:
      'Direct Flux/Gemini image generation keys pending in environment — rendered via atmospheric visual fallback.',
  };
}
