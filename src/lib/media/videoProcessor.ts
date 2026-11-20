import { VideoKeyframe } from '../types';

export interface ExtractedVideoSample {
  durationSec: number;
  width: number;
  height: number;
  mimeType: string;
  posterDataUrl: string;
  keyframes: VideoKeyframe[];
  isOverDurationLimit: boolean;
}

export const MAX_RECOMMENDED_VIDEO_DURATION_SEC = 600; // 10 minutes
export const VIDEO_CHUNK_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB chunks (safely below Cloud Run 32 MB limit)

export function formatVideoDurationLabel(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function normalizeVideoMimeType(file: File): string {
  const rawType = (file.type || '').toLowerCase();
  if (rawType.includes('quicktime') || file.name.toLowerCase().endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (rawType.includes('webm') || file.name.toLowerCase().endsWith('.webm')) {
    return 'video/webm';
  }
  return 'video/mp4';
}

function createFallbackCinemaPoster(fileName: string, durationSec: number): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const grad = ctx.createLinearGradient(0, 0, 480, 270);
    grad.addColorStop(0, '#1B1534');
    grad.addColorStop(0.5, '#2C1B4E');
    grad.addColorStop(1, '#120E24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 480, 270);

    // Subtle film accent glow
    ctx.fillStyle = 'rgba(241, 152, 183, 0.16)';
    ctx.beginPath();
    ctx.arc(240, 135, 90, 0, Math.PI * 2);
    ctx.fill();

    // Play triangle
    ctx.fillStyle = '#F5E1C8';
    ctx.beginPath();
    ctx.moveTo(222, 110);
    ctx.lineTo(222, 160);
    ctx.lineTo(265, 135);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 225, 200, 0.85)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const cleanName = (fileName || 'Sanctuary Video Clip').slice(0, 38);
    ctx.fillText(cleanName, 240, 215);

    if (durationSec > 0) {
      ctx.fillStyle = 'rgba(179, 157, 229, 0.9)';
      ctx.font = '12px monospace';
      ctx.fillText(formatVideoDurationLabel(durationSec), 240, 238);
    }

    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}

/**
 * Extracts video duration, dimensions, a compact JPEG poster thumbnail (< 25 KB),
 * and an 8-frame Timestamped Storyboard using zero-copy `URL.createObjectURL(file)`.
 * Never converts the raw video file into Base64 in browser RAM.
 */
export async function extractVideoMetadataAndStoryboard(
  file: File,
  options?: { keyframeCount?: number; maxDimension?: number; jpegQuality?: number }
): Promise<ExtractedVideoSample> {
  const keyframeCount = options?.keyframeCount ?? 8;
  const maxDimension = options?.maxDimension ?? 512;
  const jpegQuality = options?.jpegQuality ?? 0.64;
  const mimeType = normalizeVideoMimeType(file);

  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return {
      durationSec: 15,
      width: 1280,
      height: 720,
      mimeType,
      posterDataUrl: '',
      keyframes: [],
      isOverDurationLimit: false,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  try {
    const metadataLoaded = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 6000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve(true);
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };
      video.src = objectUrl;
    });

    if (!metadataLoaded) {
      const fallbackPoster = createFallbackCinemaPoster(file.name, 0);
      return {
        durationSec: 0,
        width: 1280,
        height: 720,
        mimeType,
        posterDataUrl: fallbackPoster,
        keyframes: fallbackPoster
          ? [{ timestampSec: 0, timestampLabel: '00:00', dataUrl: fallbackPoster }]
          : [],
        isOverDurationLimit: false,
      };
    }

    const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
    const durationSec = Math.round(rawDuration * 10) / 10;
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const scale = Math.min(1, maxDimension / Math.max(rawW, rawH));
    const targetW = Math.max(64, Math.round(rawW * scale));
    const targetH = Math.max(64, Math.round(rawH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const keyframes: VideoKeyframe[] = [];
    const effectiveMaxSec = Math.min(durationSec, MAX_RECOMMENDED_VIDEO_DURATION_SEC);
    const actualFrameCount = durationSec <= 3 ? Math.min(3, keyframeCount) : keyframeCount;

    const samplePositions: number[] = [];
    for (let i = 0; i < actualFrameCount; i++) {
      const ratio = actualFrameCount === 1 ? 0.15 : 0.05 + (i / (actualFrameCount - 1)) * 0.87;
      const t = Math.min(Math.max(0.1, effectiveMaxSec * ratio), Math.max(0.1, durationSec - 0.1));
      samplePositions.push(Math.round(t * 10) / 10);
    }

    for (const targetSec of samplePositions) {
      const seekOk = await new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => resolve(false), 1800);
        const onSeeked = () => {
          window.clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve(true);
        };
        video.addEventListener('seeked', onSeeked);
        try {
          video.currentTime = targetSec;
        } catch {
          window.clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve(false);
        }
      });

      if (seekOk && ctx) {
        try {
          ctx.drawImage(video, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            keyframes.push({
              timestampSec: targetSec,
              timestampLabel: formatVideoDurationLabel(targetSec),
              dataUrl,
            });
          }
        } catch {
          // Ignore canvas taint/decode issue on specific frame
        }
      }
    }

    const posterDataUrl =
      keyframes[0]?.dataUrl || createFallbackCinemaPoster(file.name, durationSec);

    return {
      durationSec,
      width: rawW,
      height: rawH,
      mimeType,
      posterDataUrl,
      keyframes:
        keyframes.length > 0
          ? keyframes
          : posterDataUrl
          ? [{ timestampSec: 0, timestampLabel: '00:00', dataUrl: posterDataUrl }]
          : [],
      isOverDurationLimit: durationSec > MAX_RECOMMENDED_VIDEO_DURATION_SEC,
    };
  } finally {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      // ignore
    }
    URL.revokeObjectURL(objectUrl);
  }
}

export interface FinalizedVideoIngestionResult {
  uploadId: string;
  geminiFileUri?: string;
  geminiFileState?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  geminiFileExpiresAt?: number;
  acousticTranscript: string;
  mediaDigest: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

/**
 * Slices a video file into 8 MB binary slices (`file.slice(start, end)`) and uploads them
 * sequentially to `/api/media/upload-chunk`, then finalizes via `/api/media/finalize-video`
 * to register the Gemini Files API handle and run the Gemma Acoustic & Lyric Transcriber.
 */
export async function uploadVideoInChunks(params: {
  file: File;
  uploadId: string;
  mimeType: string;
  durationSec: number;
  posterDataUrl: string;
  keyframes: VideoKeyframe[];
  respondingEntityId: string;
  idToken?: string;
  onProgress?: (percent: number, stageLabel: string) => void;
  signal?: AbortSignal;
}): Promise<FinalizedVideoIngestionResult> {
  const {
    file,
    uploadId,
    mimeType,
    durationSec,
     keyframes,
    respondingEntityId,
    idToken,
    onProgress,
    signal,
  } = params;

  const totalBytes = file.size || 1;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / VIDEO_CHUNK_SIZE_BYTES));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (signal?.aborted) {
      throw new Error('Video upload cancelled.');
    }

    const start = chunkIndex * VIDEO_CHUNK_SIZE_BYTES;
    const end = Math.min(totalBytes, start + VIDEO_CHUNK_SIZE_BYTES);
    const slice = file.slice(start, end);
    const buffer = await slice.arrayBuffer();
    const chunkBase64 = arrayBufferToBase64(buffer);

    const pct = Math.min(78, Math.round(((chunkIndex + 0.5) / totalChunks) * 78));
    onProgress?.(
      pct,
      totalChunks > 1
        ? `Uploading video chunk ${chunkIndex + 1} of ${totalChunks}...`
        : 'Uploading video clip...'
    );

    const res = await fetch('/api/media/upload-chunk', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uploadId,
        chunkIndex,
        totalChunks,
        fileName: file.name,
        mimeType,
        chunkBase64,
      }),
      signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed uploading video chunk ${chunkIndex + 1}`);
    }
  }

  onProgress?.(85, 'Preparing audio & visual bridge for your companions...');

  const finalizeRes = await fetch('/api/media/finalize-video', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      uploadId,
      fileName: file.name,
      mimeType,
      durationSec,
      byteSize: file.size,
      respondingEntityId,
      // Send up to 6 compact keyframes so the server can also produce a visual+audio digest even if Files API is busy
      keyframes: keyframes.slice(0, 6),
    }),
    signal,
  });

  if (!finalizeRes.ok) {
    const errBody = await finalizeRes.json().catch(() => ({}));
    throw new Error(errBody.error || 'Failed finalizing video ingestion');
  }

  const finalized = (await finalizeRes.json()) as FinalizedVideoIngestionResult;
  onProgress?.(100, 'Video ready in Sanctuary!');
  return finalized;
}
