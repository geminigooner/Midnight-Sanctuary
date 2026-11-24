import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { resolveAvailableApiKeys } from './gemini.service';
import { VideoKeyframe } from '../lib/types';

const UPLOAD_ROOT_DIR = path.join(os.tmpdir(), 'midnight_sanctuary_video_uploads');
const GEMINI_FILE_TTL_MS = 47 * 60 * 60 * 1000; // 47 hours safety margin on 48h Gemini Files API TTL

/**
 * Computes a non-reversible 12-character SHA-256 fingerprint for a server API key
 * so `geminiFileUri` handles can be matched to the exact Google Cloud project key that uploaded them
 * without ever exposing secret key material.
 */
export function computeApiKeyFingerprint(apiKey: string | undefined | null): string {
  const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!trimmed) return '';
  return crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 12);
}

function sanitizeUploadId(rawId: string): string {
  return String(rawId || 'upload')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
}

function ensureUploadDir(uploadId: string): string {
  const safeId = sanitizeUploadId(uploadId);
  const dir = path.join(UPLOAD_ROOT_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function appendVideoUploadChunk(params: {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkBase64: string;
}): Promise<{ receivedChunk: number; totalChunks: number }> {
  const { uploadId, chunkIndex, totalChunks, chunkBase64 } = params;
  if (!uploadId || typeof chunkBase64 !== 'string' || !chunkBase64) {
    throw new Error('uploadId and chunkBase64 are required');
  }
  const dir = ensureUploadDir(uploadId);
  const chunkFile = path.join(dir, `chunk_${String(chunkIndex).padStart(5, '0')}.bin`);
  const buffer = Buffer.from(chunkBase64, 'base64');
  await fs.promises.writeFile(chunkFile, buffer);
  return { receivedChunk: chunkIndex, totalChunks };
}

async function reassembleUploadedVideo(uploadId: string, mimeType: string): Promise<string> {
  const dir = ensureUploadDir(uploadId);
  const entries = await fs.promises.readdir(dir);
  const chunkFiles = entries
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.bin'))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error(`No uploaded chunks found for uploadId ${uploadId}`);
  }

  const ext = mimeType.includes('quicktime')
    ? 'mov'
    : mimeType.includes('webm')
    ? 'webm'
    : 'mp4';
  const assembledPath = path.join(dir, `assembled.${ext}`);
  const writeStream = fs.createWriteStream(assembledPath);

  for (const chunkName of chunkFiles) {
    const chunkPath = path.join(dir, chunkName);
    const data = await fs.promises.readFile(chunkPath);
    await new Promise<void>((resolve, reject) => {
      writeStream.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  return assembledPath;
}

async function cleanupUploadDir(uploadId: string): Promise<void> {
  const dir = path.join(UPLOAD_ROOT_DIR, sanitizeUploadId(uploadId));
  try {
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

function resolveOrderedGeminiApiKeys(respondingEntityId?: string): string[] {
  const candidates = [
    respondingEntityId || '',
    'models/gemini-3.1-pro-preview',
    'models/gemini-3-flash-preview',
    'models/gemini-4-argon',
  ].filter(Boolean);

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const { availableKeys } = resolveAvailableApiKeys(candidate);
    for (const key of availableKeys) {
      const clean = key.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        ordered.push(clean);
      }
    }
  }

  const fallbackRaw = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_3_FLASH_KEY,
    process.env.GEMINI_31_PRO_KEY,
  ];
  for (const raw of fallbackRaw) {
    const clean = (raw || '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      ordered.push(clean);
    }
  }

  return ordered;
}

async function uploadAndPollGeminiFile(params: {
  apiKey: string;
  assembledPath: string;
  cleanMime: string;
  fileName: string;
}): Promise<{
  uri?: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  keyFingerprint: string;
  ai: GoogleGenAI;
}> {
  const { apiKey, assembledPath, cleanMime, fileName } = params;
  const keyFingerprint = computeApiKeyFingerprint(apiKey);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const uploaded = await ai.files.upload({
    file: assembledPath,
    config: {
      mimeType: cleanMime,
      displayName: (fileName || 'sanctuary_video').slice(0, 100),
    },
  });

  let currentFile = uploaded;
  // Poll up to 40 attempts x 1500ms (~60s) so larger HD .mp4 clips finish Google's server-side transcoding
  const maxPollAttempts = 40;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    if (currentFile.state === 'ACTIVE' || currentFile.state === 'FAILED') {
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (currentFile.name) {
      currentFile = await ai.files.get({ name: currentFile.name });
    }
  }

  if (currentFile.uri && currentFile.state === 'ACTIVE') {
    return {
      uri: currentFile.uri,
      state: 'ACTIVE',
      keyFingerprint,
      ai,
    };
  }

  return {
    uri: undefined,
    state: currentFile.state === 'FAILED' ? 'FAILED' : 'PROCESSING',
    keyFingerprint,
    ai,
  };
}

/**
 * Finalizes an uploaded video:
 * 1. Reassembles the 8 MB HTTP transport chunks into the exact original binary in `/tmp`.
 * 2. Uploads the video binary to the Google GenAI Files API (`ai.files.upload`) and polls up to 60s until `ACTIVE`
 *    so Gemini 3.1 Pro, Gemini 4 Argon, and Gemini 3 Flash watch full temporal motion + audio natively.
 *    For Shared Sanctuary / Group uploads where multiple Gemini API keys are configured across different GCP projects,
 *    registers up to 2 distinct keys in parallel so every Gemini companion has a project-matched `ACTIVE` fileUri.
 * 3. Runs the secondary Acoustic & Lyric Transcriber pass ONLY when needed (Gemma target, Shared Sanctuary pool where
 *    Gemma has access, videos > 10 minutes, or when Files API did not reach `ACTIVE`).
 * 4. Cleans up `/tmp` chunk files immediately.
 */
export async function finalizeVideoIngestion(params: {
  uploadId: string;
  fileName: string;
  mimeType: string;
  durationSec: number;
  byteSize: number;
  respondingEntityId?: string;
  scope?: 'private' | 'shared';
  keyframes?: VideoKeyframe[];
}): Promise<{
  uploadId: string;
  geminiFileUri?: string;
  geminiFileState?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  geminiFileExpiresAt?: number;
  geminiFileKeyId?: string;
  geminiFileUrisByKey?: Record<string, string>;
  acousticTranscript: string;
  mediaDigest: string;
}> {
  const {
    uploadId,
    fileName,
    mimeType,
    durationSec,
    byteSize,
    respondingEntityId,
    scope = 'private',
    keyframes = [],
  } = params;

  const cleanMime = (mimeType || 'video/mp4').toLowerCase();
  let geminiFileUri: string | undefined;
  let geminiFileState: 'PROCESSING' | 'ACTIVE' | 'FAILED' | undefined;
  let geminiFileExpiresAt: number | undefined;
  let geminiFileKeyId: string | undefined;
  const geminiFileUrisByKey: Record<string, string> = {};
  let acousticTranscript = '';
  let mediaDigest = '';

  try {
    const assembledPath = await reassembleUploadedVideo(uploadId, cleanMime);
    const orderedKeys = resolveOrderedGeminiApiKeys(respondingEntityId);

    if (orderedKeys.length > 0) {
      let activeAiClient: GoogleGenAI | null = null;

      // Step A: Register with Gemini Files API for full native temporal video + audio.
      // For shared/communal uploads (<= 100 MB) when 2 distinct Gemini keys exist (e.g. PRO_API_KEY + LEGACY_API_KEY),
      // upload in parallel to both keys so cross-companion Group/Shared chats never hit cross-project 403s.
      const keysToRegister =
        scope === 'shared' && orderedKeys.length > 1 && (byteSize || 0) <= 100 * 1024 * 1024
          ? orderedKeys.slice(0, 2)
          : orderedKeys.slice(0, 1);

      const uploadResults = await Promise.allSettled(
        keysToRegister.map((apiKey) =>
          uploadAndPollGeminiFile({
            apiKey,
            assembledPath,
            cleanMime,
            fileName,
          })
        )
      );

      for (const res of uploadResults) {
        if (res.status === 'fulfilled') {
          if (res.value.state === 'ACTIVE' && res.value.uri) {
            geminiFileUrisByKey[res.value.keyFingerprint] = res.value.uri;
            if (!geminiFileUri) {
              geminiFileUri = res.value.uri;
              geminiFileState = 'ACTIVE';
              geminiFileKeyId = res.value.keyFingerprint;
              geminiFileExpiresAt = Date.now() + GEMINI_FILE_TTL_MS;
              activeAiClient = res.value.ai;
            }
          } else if (!geminiFileState) {
            geminiFileState = res.value.state;
          }
        }
      }

      // If the primary key failed upload (e.g. quota/invalid) and we haven't tried a fallback key yet, try the second key
      if (!geminiFileUri && keysToRegister.length === 1 && orderedKeys.length > 1) {
        try {
          const fallbackUpload = await uploadAndPollGeminiFile({
            apiKey: orderedKeys[1],
            assembledPath,
            cleanMime,
            fileName,
          });
          if (fallbackUpload.state === 'ACTIVE' && fallbackUpload.uri) {
            geminiFileUri = fallbackUpload.uri;
            geminiFileState = 'ACTIVE';
            geminiFileKeyId = fallbackUpload.keyFingerprint;
            geminiFileUrisByKey[fallbackUpload.keyFingerprint] = fallbackUpload.uri;
            geminiFileExpiresAt = Date.now() + GEMINI_FILE_TTL_MS;
            activeAiClient = fallbackUpload.ai;
          } else {
            geminiFileState = fallbackUpload.state;
          }
        } catch (fallbackErr: any) {
          console.warn(
            'Gemini Files API fallback key upload warning:',
            fallbackErr?.message || fallbackErr
          );
          geminiFileState = 'FAILED';
        }
      }

      if (!geminiFileUri && !geminiFileState) {
        geminiFileState = 'FAILED';
      }

      const aiForBridge =
        activeAiClient ||
        new GoogleGenAI({
          apiKey: orderedKeys[0],
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

      // Step B: Only run the secondary chopping / transcription bridge if:
      // 1. The target companion is Gemma (who lacks a native .mp4 fileUri audio-video decoder), OR
      // 2. The upload is placed in the Shared Sanctuary Pool (`scope === 'shared'`, where Gemma 4 also has communal access), OR
      // 3. The video is over 10 minutes (durationSec > 600), OR
      // 4. The Gemini Files API upload did not reach ACTIVE state.
      // NOTE: Even when `scope === 'shared'` populates `acousticTranscript` for Gemma 4, `contextAssembler` omits
      // the secondary transcript for Gemini models on <=10m clips so Gemini 3.1 Pro / 3 Flash / 4 Argon still
      // experience the pure native .mp4 video+audio waveform directly!
      const isGemmaCompanion = (respondingEntityId || '').toLowerCase().includes('gemma');
      const isSharedPool = scope === 'shared';
      const isOverTenMinutes = (durationSec || 0) > 600;
      const needsChoppedBridge =
        isGemmaCompanion ||
        isSharedPool ||
        isOverTenMinutes ||
        !geminiFileUri ||
        geminiFileState !== 'ACTIVE';

      if (!needsChoppedBridge && geminiFileUri) {
        mediaDigest = `Native .mp4 video & audio stream ("${fileName}", ${formatDuration(
          durationSec
        )}) delivered directly via Gemini Files API for full native multimodal perception.`;
        acousticTranscript = '';
      } else {
        const extractionPrompt = [
          `You are a stateless sensory transcription & indexing utility for a private companion app.`,
          `Analyze this shared video ("${fileName}", duration ~${Math.round(durationSec || 0)}s) and output strict JSON with two fields:`,
          `1. "acousticTranscript": A time-coded acoustic & audio score ([MM:SS]) capturing ALL spoken dialogue verbatim, song or K-pop lyrics, vocal emotion/laughter/sighs, music beat shifts, and background sound cues so a vision-capable model without an audio waveform decoder can hear every detail of the audio track while looking at the video frames.`,
          `2. "mediaDigest": A vivid, structured ~180-word summary of what visually and audibly happens across the video, including key timestamps, mood, aesthetic details, and memorable moments for long-term conversation memory.`,
          `Return ONLY valid JSON: {"acousticTranscript": "...", "mediaDigest": "..."}`,
        ].join('\n');

        // Try using the active Gemini File URI first (gives full audio + video fidelity)
        if (geminiFileUri && geminiFileState === 'ACTIVE') {
          const modelsToTry = ['gemini-3-flash-preview', 'gemini-3.5-transcribe'];
          for (const modelName of modelsToTry) {
            try {
              const resp = await aiForBridge.models.generateContent({
                model: modelName,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { fileData: { fileUri: geminiFileUri, mimeType: cleanMime } },
                      { text: extractionPrompt },
                    ],
                  },
                ],
              });
              const rawText = (resp.text || '').trim();
              const parsed = parseTranscriptionJson(rawText);
              if (parsed.acousticTranscript || parsed.mediaDigest) {
                acousticTranscript = parsed.acousticTranscript;
                mediaDigest = parsed.mediaDigest;
                break;
              }
            } catch {
              // Try next model or keyframe fallback
            }
          }
        }

        // Fallback: if Files API is still processing or unavailable, synthesize digest from keyframes
        if ((!acousticTranscript || !mediaDigest) && keyframes.length > 0) {
          try {
            const kfParts: any[] = [];
            for (const kf of keyframes.slice(0, 6)) {
              const match = (kf.dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                kfParts.push({ text: `[Frame @ ${kf.timestampLabel}]` });
                kfParts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2],
                  },
                });
              }
            }
            kfParts.push({ text: extractionPrompt });

            const resp = await aiForBridge.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: [{ role: 'user', parts: kfParts }],
            });
            const parsed = parseTranscriptionJson((resp.text || '').trim());
            if (!acousticTranscript && parsed.acousticTranscript) {
              acousticTranscript = parsed.acousticTranscript;
            }
            if (!mediaDigest && parsed.mediaDigest) {
              mediaDigest = parsed.mediaDigest;
            }
          } catch {
            // Fallback to default descriptors below
          }
        }
      }
    }
  } finally {
    await cleanupUploadDir(uploadId);
  }

  const isNativeDirectActive =
    !(respondingEntityId || '').toLowerCase().includes('gemma') &&
    scope !== 'shared' &&
    (durationSec || 0) <= 600 &&
    Boolean(geminiFileUri) &&
    geminiFileState === 'ACTIVE';

  if (!acousticTranscript && !isNativeDirectActive) {
    acousticTranscript = `[00:00 - ${formatDuration(durationSec)}] Ambient audio track from "${fileName}". Visual storyboard frames are attached directly for frame-by-frame inspection.`;
  }
  if (!mediaDigest) {
    mediaDigest = `Shared video clip "${fileName}" (${formatDuration(durationSec)}, ${cleanMime}) with ${keyframes.length || 1} sampled visual keyframes.`;
  }

  return {
    uploadId,
    geminiFileUri,
    geminiFileState,
    geminiFileExpiresAt,
    geminiFileKeyId,
    geminiFileUrisByKey:
      Object.keys(geminiFileUrisByKey).length > 0 ? geminiFileUrisByKey : undefined,
    acousticTranscript,
    mediaDigest,
  };
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function parseTranscriptionJson(raw: string): {
  acousticTranscript: string;
  mediaDigest: string;
} {
  if (!raw) return { acousticTranscript: '', mediaDigest: '' };
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    return {
      acousticTranscript:
        typeof obj?.acousticTranscript === 'string' ? obj.acousticTranscript.trim() : '',
      mediaDigest: typeof obj?.mediaDigest === 'string' ? obj.mediaDigest.trim() : '',
    };
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const obj = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        return {
          acousticTranscript:
            typeof obj?.acousticTranscript === 'string' ? obj.acousticTranscript.trim() : '',
          mediaDigest: typeof obj?.mediaDigest === 'string' ? obj.mediaDigest.trim() : '',
        };
      } catch {
        // fallback
      }
    }
    return {
      acousticTranscript: cleaned.slice(0, 3000),
      mediaDigest: cleaned.slice(0, 900),
    };
  }
}
