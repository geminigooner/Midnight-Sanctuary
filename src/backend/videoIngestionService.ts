import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { resolveAvailableApiKeys } from './gemini.service';
import { VideoKeyframe } from '../lib/types';

const UPLOAD_ROOT_DIR = path.join(os.tmpdir(), 'midnight_sanctuary_video_uploads');
const GEMINI_FILE_TTL_MS = 47 * 60 * 60 * 1000; // 47 hours safety margin on 48h Gemini Files API TTL

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

function resolveAnyGeminiApiKey(respondingEntityId?: string): string | null {
  const candidates = [
    respondingEntityId || '',
    'models/gemini-3-flash-preview',
    'models/gemini-3.1-pro-preview',
    'models/gemini-4-argon',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const { availableKeys } = resolveAvailableApiKeys(candidate);
    if (availableKeys.length > 0 && availableKeys[0]) {
      return availableKeys[0];
    }
  }

  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_3_FLASH_KEY ||
    process.env.GEMINI_31_PRO_KEY ||
    null
  );
}

/**
 * Finalizes an uploaded video:
 * 1. Reassembles the 8 MB chunks in `/tmp`.
 * 2. Uploads the video binary to the Google GenAI Files API (`ai.files.upload`) and polls until `ACTIVE`
 *    so Gemini 3.1 Pro, Gemini 4 Argon, and Gemini 3 Flash can watch full temporal motion + audio natively.
 * 3. Runs a fast, stateless Acoustic & Lyric Transcriber pass (`gemini-3.5-transcribe` with `gemini-3-flash-preview`
 *    multimodal fallback) to produce:
 *    - `acousticTranscript`: Time-coded spoken dialogue, song/K-pop lyrics, vocal tone, laughter, and ambient audio cues
 *      specifically engineered for Gemma 4 (`26B-A4B` Sparse MoE) to pair with her 550M vision encoder keyframes.
 *    - `mediaDigest`: Concise ~200-word structured narrative summary of visual + audio highlights for long-term conversation memory.
 * 4. Cleans up `/tmp` chunk files immediately.
 */
export async function finalizeVideoIngestion(params: {
  uploadId: string;
  fileName: string;
  mimeType: string;
  durationSec: number;
  byteSize: number;
  respondingEntityId?: string;
  keyframes?: VideoKeyframe[];
}): Promise<{
  uploadId: string;
  geminiFileUri?: string;
  geminiFileState?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  geminiFileExpiresAt?: number;
  acousticTranscript: string;
  mediaDigest: string;
}> {
  const {
    uploadId,
    fileName,
    mimeType,
    durationSec,
    respondingEntityId,
    keyframes = [],
  } = params;

  const cleanMime = (mimeType || 'video/mp4').toLowerCase();
  let geminiFileUri: string | undefined;
  let geminiFileState: 'PROCESSING' | 'ACTIVE' | 'FAILED' | undefined;
  let geminiFileExpiresAt: number | undefined;
  let acousticTranscript = '';
  let mediaDigest = '';

  try {
    const assembledPath = await reassembleUploadedVideo(uploadId, cleanMime);
    const apiKey = resolveAnyGeminiApiKey(respondingEntityId);

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });

      // Step A: Register with Gemini Files API for full native temporal video + audio
      try {
        const uploaded = await ai.files.upload({
          file: assembledPath,
          config: {
            mimeType: cleanMime,
            displayName: (fileName || 'sanctuary_video').slice(0, 100),
          },
        });

        let currentFile = uploaded;
        const maxPollAttempts = 16;
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
          geminiFileUri = currentFile.uri;
          geminiFileState = 'ACTIVE';
          geminiFileExpiresAt = Date.now() + GEMINI_FILE_TTL_MS;
        } else if (currentFile.uri) {
          geminiFileUri = currentFile.uri;
          geminiFileState = (currentFile.state as any) || 'PROCESSING';
          geminiFileExpiresAt = Date.now() + GEMINI_FILE_TTL_MS;
        }
      } catch (uploadErr: any) {
        console.warn('Gemini Files API upload warning (falling back to storyboard+transcript):', uploadErr?.message || uploadErr);
        geminiFileState = 'FAILED';
      }

      // Step B: Stateless Acoustic & Lyric Transcriber + Media Memory Digest for Gemma MoE & Long-Term Memory
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
            const resp = await ai.models.generateContent({
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

          const resp = await ai.models.generateContent({
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
  } finally {
    await cleanupUploadDir(uploadId);
  }

  if (!acousticTranscript) {
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
