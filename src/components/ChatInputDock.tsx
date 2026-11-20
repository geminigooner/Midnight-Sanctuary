import React, { useState, useRef } from 'react';
import { Conversation, Message, VideoAttachmentMeta } from '../lib/types';
import {
  Send,
  StopCircle,
  RefreshCw,
  Paperclip,
  Gift,
  X,
  Film,
  Lock,
  Users,
  FolderHeart,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { compressImage } from '../lib/imageUtils';
import { useStore, useUI } from '../context/AppContext';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';
import {
  extractVideoMetadataAndStoryboard,
  uploadVideoInChunks,
  formatVideoDurationLabel,
} from '../lib/media/videoProcessor';
import { MediaStorageService } from '../lib/media/mediaStorageService';
import { getSharedPersistenceCoordinator } from '../lib/store';
import { resolveCanonicalEntityId } from '../lib/domains/entityDomain';
import { getAllEntities } from '../lib/entitySystem';

export interface ChatInputDockProps {
  conversation: Conversation;
  visibleMessages: Message[];
  isGenerating: boolean;
  input: string;
  setInput: (value: string) => void;
  attachments: { mimeType: string; data: string; previewUrl?: string }[];
  setAttachments: React.Dispatch<
    React.SetStateAction<{ mimeType: string; data: string; previewUrl?: string }[]>
  >;
  videoAttachments?: VideoAttachmentMeta[];
  setVideoAttachments?: React.Dispatch<React.SetStateAction<VideoAttachmentMeta[]>>;
  onSend: (
    text?: string,
    replaceIndex?: number,
    additionalMessages?: Message[],
    sendAttachments?: any[],
    sendVideoAttachments?: VideoAttachmentMeta[]
  ) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
}

interface UploadingVideoState {
  fileName: string;
  progressPct: number;
  stageLabel: string;
  durationSec: number;
  posterDataUrl: string;
  scope: 'private' | 'shared';
  warning?: string;
}

export function ChatInputDock({
  conversation,
  visibleMessages,
  isGenerating,
  input,
  setInput,
  attachments,
  setAttachments,
  videoAttachments = [],
  setVideoAttachments,
  onSend,
  onStopGeneration,
  onRegenerate,
}: ChatInputDockProps) {
  const store = useStore();
  const ui = useUI();
  const reducedMotion = useReducedMotion();
  const sharedTransition = getMotion('shared', reducedMotion);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const giftFileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const [showLeaveGift, setShowLeaveGift] = useState(false);
  const [giftContent, setGiftContent] = useState('');
  const [giftFile, setGiftFile] = useState<{
    mimeType: string;
    data: string;
    previewUrl?: string;
  } | null>(null);
  const [showDebugModel, setShowDebugModel] = useState(false);

  const [videoVaultScope, setVideoVaultScope] = useState<'private' | 'shared'>('private');
  const [uploadingVideo, setUploadingVideo] = useState<UploadingVideoState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const activeModelId =
    conversation?.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';
  const canonicalEntityId = resolveCanonicalEntityId(activeModelId);
  const allEntities = getAllEntities(store.settings.customEntities);
  const activeCompanion =
    allEntities.find((e) => e.id === canonicalEntityId) || allEntities[0];

  const handleGiftFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files can be attached to a gift offering.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setGiftFile(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
    }

    if (giftFileInputRef.current) giftFileInputRef.current.value = '';
  };

  const handleCancelVideoUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setUploadingVideo(null);
  };

  const handleVideoFileSelected = async (file: File) => {
    setUploadError(null);
    const chosenScope = videoVaultScope;
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    try {
      setUploadingVideo({
        fileName: file.name,
        progressPct: 4,
        stageLabel: 'Sampling 8-frame storyboard & poster...',
        durationSec: 0,
        posterDataUrl: '',
        scope: chosenScope,
      });

      const sample = await extractVideoMetadataAndStoryboard(file);
      if (abortController.signal.aborted) return;

      const overLimitNote = sample.isOverDurationLimit
        ? 'Clip exceeds 10m; first 10:00 sampled for storyboard keyframes.'
        : undefined;

      setUploadingVideo({
        fileName: file.name,
        progressPct: 12,
        stageLabel: 'Uploading 8 MB binary chunks...',
        durationSec: sample.durationSec,
        posterDataUrl: sample.posterDataUrl,
        scope: chosenScope,
        warning: overLimitNote,
      });

      let idToken: string | undefined;
      try {
        if (store.user && typeof store.user.getIdToken === 'function') {
          idToken = await store.user.getIdToken();
        }
      } catch {
        // Proceed without token in dev/local preview
      }

      // Parallel binary persistence into IndexedDB + Cloud Storage (best-effort)
      const mediaService = new MediaStorageService(getSharedPersistenceCoordinator());
      const storagePromise = mediaService
        .storeBinaryVideoAsset({
          file,
          mimeType: sample.mimeType,
          category: 'message_attachment',
          referenceTag: `conv:${conversation?.id || 'draft'}:video:${Date.now()}`,
          ownerEntityId: canonicalEntityId,
        })
        .catch((err) => {
          console.warn('Local/Cloud binary video cache warning:', err);
          return null;
        });

      const uploadId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const finalized = await uploadVideoInChunks({
        file,
        uploadId,
        mimeType: sample.mimeType,
        durationSec: sample.durationSec,
        posterDataUrl: sample.posterDataUrl,
        keyframes: sample.keyframes,
        respondingEntityId: canonicalEntityId,
        idToken,
        signal: abortController.signal,
        onProgress: (progressPct, stageLabel) => {
          setUploadingVideo((prev) =>
            prev
              ? {
                  ...prev,
                  progressPct,
                  stageLabel,
                }
              : null
          );
        },
      });

      const storedAsset = await storagePromise;
      if (abortController.signal.aborted) return;

      // Save item to the chosen Sanctuary Vault (Private Companion Vault or Shared Pool)
      const vaultItem = store.addVaultItem({
        scope: chosenScope,
        ownerEntityId: canonicalEntityId,
        contributedByType: 'user',
        contributedByName: store.profile?.name || 'You',
        mediaCategory: 'video',
        title: file.name,
        caption: overLimitNote,
        mimeType: sample.mimeType,
        mediaAssetId: storedAsset?.asset.id,
        downloadUrl: storedAsset?.asset.downloadUrl,
        posterDataUrl: sample.posterDataUrl,
        durationSec: sample.durationSec,
        byteSize: file.size,
        keyframes: sample.keyframes,
        geminiFileUri: finalized.geminiFileUri,
        geminiFileExpiresAt: finalized.geminiFileExpiresAt,
        acousticTranscript: finalized.acousticTranscript,
        mediaDigest: finalized.mediaDigest,
      });

      const attachmentMeta: VideoAttachmentMeta = {
        id: vaultItem.id,
        fileName: file.name,
        mimeType: sample.mimeType,
        durationSec: sample.durationSec,
        byteSize: file.size,
        width: sample.width,
        height: sample.height,
        posterDataUrl: sample.posterDataUrl,
        mediaAssetId: storedAsset?.asset.id,
        downloadUrl: storedAsset?.asset.downloadUrl,
        geminiFileUri: finalized.geminiFileUri,
        geminiFileExpiresAt: finalized.geminiFileExpiresAt,
        keyframes: sample.keyframes,
        acousticTranscript: finalized.acousticTranscript,
        mediaDigest: finalized.mediaDigest,
        scope: chosenScope,
        ownerEntityId: canonicalEntityId,
        vaultItemId: vaultItem.id,
      };

      if (setVideoAttachments) {
        setVideoAttachments((prev) => [...prev, attachmentMeta]);
      }
      setUploadingVideo(null);
    } catch (err: any) {
      if (err?.message?.includes('cancelled')) {
        setUploadingVideo(null);
        return;
      }
      console.error('Video ingestion failed:', err);
      setUploadError(err?.message || 'Could not process video clip.');
      setUploadingVideo(null);
    } finally {
      uploadAbortRef.current = null;
    }
  };

  const handleToggleStagedVideoScope = (videoId: string) => {
    if (!setVideoAttachments) return;
    setVideoAttachments((prev) =>
      prev.map((vid) => {
        if (vid.id !== videoId) return vid;
        const nextScope: 'private' | 'shared' =
          vid.scope === 'shared' ? 'private' : 'shared';
        if (nextScope === 'shared' && vid.vaultItemId) {
          store.promoteVaultItemToShared(canonicalEntityId, vid.vaultItemId);
        }
        return {
          ...vid,
          scope: nextScope,
        };
      })
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);

    if (isVideo) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      await handleVideoFileSelected(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image or a video clip (.mp4, .mov, .webm).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadError(null);
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      const MAX_DIMENSION = 1536;
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');

      ctx.drawImage(img, 0, 0, width, height);

      const targetMimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = 0.8;

      const dataUrl = canvas.toDataURL(targetMimeType, quality);
      const base64Data = dataUrl.split(',')[1];

      setAttachments((prev) => [
        ...prev,
        {
          mimeType: targetMimeType,
          data: base64Data,
          previewUrl: dataUrl,
        },
      ]);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Error compressing image:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        setAttachments((prev) => [
          ...prev,
          {
            mimeType: file.type,
            data: base64Data,
            previewUrl: result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSend =
    !uploadingVideo &&
    (Boolean(input.trim()) || attachments.length > 0 || videoAttachments.length > 0);

  return (
    <div className="p-3 sm:p-4 bg-[#151234] border-t-[3px] border-[#2C194D] z-10 transition-colors duration-500 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto relative">
        <motion.div className="flex flex-col gap-2 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-2 transition-all duration-300 focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
          {/* Upload Error Banner */}
          {uploadError && (
            <div className="flex items-center justify-between gap-2 mx-2 mt-1 px-3 py-2 rounded-2xl bg-[#151234] border-[2px] border-[#F198B7] text-[#F5E1C8] text-xs font-bold">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={15} className="text-[#F198B7] shrink-0" />
                <span className="truncate">{uploadError}</span>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="p-1 text-[#B39DE5] hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Active Chunked Video Upload Progress Card */}
          {uploadingVideo && (
            <div className="mx-2 mt-2 p-3 rounded-2xl bg-[#151234] border-[2.5px] border-[#2C194D] text-[#F5E1C8] shadow-[3px_3px_0_#2C194D]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {uploadingVideo.posterDataUrl ? (
                    <img
                      src={uploadingVideo.posterDataUrl}
                      alt="Video preview"
                      className="w-12 h-12 rounded-xl object-cover border-[2px] border-[#2C194D] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#2C194D] flex items-center justify-center text-[#F198B7] shrink-0">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold truncate max-w-[200px] sm:max-w-xs">
                        {uploadingVideo.fileName}
                      </span>
                      {uploadingVideo.durationSec > 0 && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#2C194D] text-[#F198B7] tabular-nums">
                          {formatVideoDurationLabel(uploadingVideo.durationSec)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-[#B39DE5] truncate">
                      {uploadingVideo.stageLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-extrabold text-[#F198B7] tabular-nums">
                    {uploadingVideo.progressPct}%
                  </span>
                  <button
                    onClick={handleCancelVideoUpload}
                    className="px-2.5 py-1 rounded-xl bg-[#2C194D] hover:bg-red-500/80 text-[#F5E1C8] text-[11px] font-extrabold border border-[#F5E1C8]/20 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="mt-2.5 w-full h-2 rounded-full bg-[#2C194D] overflow-hidden">
                <div
                  className="h-full bg-[#F198B7] transition-all duration-300"
                  style={{ width: `${Math.max(5, uploadingVideo.progressPct)}%` }}
                />
              </div>
              {uploadingVideo.warning && (
                <p className="mt-1.5 text-[10px] font-bold text-[#F198B7]">
                  {uploadingVideo.warning}
                </p>
              )}
            </div>
          )}

          {/* Staged Images & Staged Cinema Videos */}
          {(attachments.length > 0 || videoAttachments.length > 0) && (
            <div className="flex flex-wrap items-center gap-2.5 px-2 pt-2 overflow-x-auto custom-scrollbar">
              {attachments.map((att, i) => (
                <div key={`img-${i}`} className="relative shrink-0">
                  <img
                    src={att.previewUrl}
                    className="h-16 w-16 object-cover rounded-xl border-[3px] border-[#2C194D]"
                    alt="attachment"
                  />
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="absolute -top-2 -right-2 bg-[#151234] text-[#F5E1C8] rounded-full p-1 border-[2.5px] border-[#2C194D] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {videoAttachments.map((vid) => (
                <div
                  key={vid.id}
                  className="relative flex items-center gap-2.5 p-2 rounded-2xl bg-[#151234] border-[2.5px] border-[#2C194D] text-[#F5E1C8] shadow-[2px_2px_0_#2C194D] shrink-0"
                >
                  <div className="relative w-14 h-12 rounded-xl overflow-hidden border-[2px] border-[#2C194D] bg-[#0B091B] shrink-0">
                    {vid.posterDataUrl ? (
                      <img
                        src={vid.posterDataUrl}
                        alt={vid.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#F198B7]">
                        <Film size={18} />
                      </div>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[9px] font-extrabold text-[#F5E1C8] tabular-nums">
                      {formatVideoDurationLabel(vid.durationSec)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 pr-4 max-w-[190px]">
                    <span className="text-xs font-extrabold text-[#F5E1C8] truncate">
                      {vid.fileName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStagedVideoScope(vid.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-colors cursor-pointer ${
                          vid.scope === 'shared'
                            ? 'bg-[#F198B7] text-[#2C194D] border-[#2C194D]'
                            : 'bg-[#9D7FE3] text-[#2C194D] border-[#2C194D]'
                        }`}
                        title="Click to switch between Private Companion Vault and Shared Sanctuary Pool"
                      >
                        {vid.scope === 'shared' ? (
                          <>
                            <Users size={10} />
                            <span>Shared Pool (All)</span>
                          </>
                        ) : (
                          <>
                            <Lock size={10} />
                            <span>Only {activeCompanion?.displayName || 'Companion'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setVideoAttachments?.((prev) => prev.filter((v) => v.id !== vid.id))
                    }
                    className="absolute -top-2 -right-2 bg-[#151234] text-[#F5E1C8] rounded-full p-1 border-[2.5px] border-[#2C194D] hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove staged video"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2">
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(uploadingVideo)}
              className="p-2.5 sm:p-3 text-[#2C194D]/70 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D] disabled:opacity-40 cursor-pointer"
              title="Attach Image or Video (.mp4, .mov, .webm up to 10 min)"
            >
              <Paperclip size={20} />
            </button>

            {/* Default Vault Destination Scope Toggle for New Uploads */}
            <button
              type="button"
              onClick={() =>
                setVideoVaultScope((prev) => (prev === 'private' ? 'shared' : 'private'))
              }
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border-[2px] border-[#2C194D] text-[11px] font-extrabold mb-1 shrink-0 transition-colors cursor-pointer ${
                videoVaultScope === 'shared'
                  ? 'bg-[#F198B7] text-[#2C194D]'
                  : 'bg-[#B39DE5]/60 text-[#2C194D]'
              }`}
              title={
                videoVaultScope === 'shared'
                  ? 'Upload Destination: Shared Sanctuary Pool (All Companions)'
                  : `Upload Destination: Private Vault (Only You & ${activeCompanion?.displayName})`
              }
            >
              {videoVaultScope === 'shared' ? (
                <>
                  <Users size={13} />
                  <span>Shared Pool</span>
                </>
              ) : (
                <>
                  <Lock size={13} />
                  <span>Private</span>
                </>
              )}
            </button>

            {/* Open Sanctuary Media Vault Modal */}
            <motion.button
              layoutId={resolveSharedLayoutId('composer-sanctuary-vault', reducedMotion)}
              transition={{ layout: sharedTransition }}
              style={{ borderRadius: 12 }}
              onClick={() =>
                ui.openModalWithOrigin('sanctuaryVault', 'composer-sanctuary-vault')
              }
              className="p-2.5 sm:p-3 text-[#2C194D]/70 hover:text-[#2C194D] hover:bg-[#B39DE5] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D] cursor-pointer"
              title="Open Sanctuary Media Vaults (Private & Shared Pool)"
            >
              <motion.span
                layoutId={resolveSharedLayoutId(
                  'composer-sanctuary-vault',
                  reducedMotion,
                  'icon'
                )}
                transition={{ layout: sharedTransition }}
                className="flex items-center justify-center"
              >
                <FolderHeart size={20} />
              </motion.span>
            </motion.button>

            <motion.button
              layoutId={resolveSharedLayoutId('composer-leave-gift', reducedMotion)}
              transition={{ layout: sharedTransition }}
              style={{ borderRadius: 12 }}
              onClick={() => setShowLeaveGift(true)}
              className="p-2.5 sm:p-3 text-[#2C194D]/70 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D] cursor-pointer"
              title="Leave a Gift"
            >
              <motion.span
                layoutId={resolveSharedLayoutId('composer-leave-gift', reducedMotion, 'icon')}
                transition={{ layout: sharedTransition }}
                className="flex items-center justify-center"
              >
                <Gift size={20} />
              </motion.span>
            </motion.button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
              placeholder="Whisper to the void (or share a video clip)..."
              className="flex-1 bg-transparent max-h-48 min-h-[44px] min-w-0 px-2 sm:px-3 py-2 resize-none outline-none text-[#2C194D] font-bold placeholder-[#2C194D]/40 custom-scrollbar text-base"
              rows={
                input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1
              }
            />

            {isGenerating ? (
              <button
                onClick={onStopGeneration}
                className="p-3 text-red-500 hover:bg-red-500/20 border-[2px] border-transparent hover:border-red-500 rounded-xl transition-colors mb-0.5 shrink-0 font-bold cursor-pointer"
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                {visibleMessages.length > 0 &&
                  visibleMessages[visibleMessages.length - 1].role === 'model' && (
                    <button
                      onClick={onRegenerate}
                      className="hidden sm:block p-3 text-[#2C194D]/80 hover:text-[#2C194D] hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl transition-colors font-bold cursor-pointer"
                      title="Regenerate Last"
                    >
                      <RefreshCw size={20} />
                    </button>
                  )}
                <button
                  onClick={() => onSend()}
                  disabled={!canSend}
                  className="p-3 text-[#2C194D] hover:bg-[#B39DE5] border-[2px] border-transparent hover:border-[#2C194D] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent rounded-xl transition-colors shrink-0 font-bold cursor-pointer"
                >
                  <Send size={20} />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <div className="flex justify-center mt-2">
          <button
            onClick={() => setShowDebugModel(!showDebugModel)}
            className="text-xs font-bold text-[#2C194D] bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl px-4 py-2 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
            title="Toggle Debug Info"
          >
            DEBUG
          </button>
        </div>

        {showDebugModel && (
          <div className="mt-4 p-4 bg-[#151234] text-xs font-mono text-green-400 overflow-y-auto max-h-64 rounded-xl border border-green-500/30">
            <strong>Diagnostics:</strong>
            <br />
            Conversation ID: {conversation.id}
            <br />
            All Messages: {conversation.messages.length}
            <br />
            Visible Messages: {visibleMessages.length}
            <br />
            Data: {JSON.stringify(conversation.messages, null, 2)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLeaveGift && (
          <SharedModalShell
            key="composer-leave-gift-modal"
            originId="composer-leave-gift"
            onClose={() => {
              setShowLeaveGift(false);
              setGiftContent('');
              setGiftFile(null);
            }}
            panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-md p-6 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <SharedModalIcon
                  originId="composer-leave-gift"
                  className="w-11 h-11 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
                >
                  <Gift size={20} />
                </SharedModalIcon>
                <div>
                  <h2 className="text-2xl font-bold text-[#F5E1C8] leading-tight">
                    Leave a Gift
                  </h2>
                  <p className="text-sm font-bold text-[#B39DE5]">
                    A small offering for the void.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLeaveGift(false);
                  setGiftContent('');
                  setGiftFile(null);
                }}
                className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[2.5px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <SharedModalBody>
              {giftFile && (
                <div className="relative mb-4">
                  <img
                    src={giftFile.previewUrl}
                    className="w-full h-32 object-cover rounded-2xl border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D]"
                    alt="gift"
                  />
                  <button
                    onClick={() => setGiftFile(null)}
                    className="absolute top-2 right-2 bg-[#F198B7] text-[#2C194D] rounded-full p-1 border-[3px] border-[#2C194D] hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <textarea
                value={giftContent}
                onChange={(e) => setGiftContent(e.target.value)}
                placeholder="Describe your gift..."
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 text-[#2C194D] font-bold text-sm resize-none h-32 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] custom-scrollbar mb-4 placeholder-[#2C194D]/40 transition-all"
              />

              <div className="flex items-center justify-between mb-4">
                <input
                  type="file"
                  accept="image/*"
                  ref={giftFileInputRef}
                  onChange={handleGiftFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => giftFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#2C194D] bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 hover:bg-[#F198B7] transition-all cursor-pointer"
                >
                  <Paperclip size={16} />
                  Attach Image
                </button>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowLeaveGift(false);
                    setGiftContent('');
                    setGiftFile(null);
                  }}
                  className="px-4 py-2 rounded-xl text-[#F198B7] border-[3px] border-[#2C194D] bg-[#151234] hover:bg-[#F198B7] hover:text-[#2C194D] transition-all text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!giftContent.trim() && !giftFile}
                  onClick={() => {
                    const targetModel =
                      conversation?.modelId ||
                      store.settings.model ||
                      'models/gemini-3.1-pro-preview';
                    store.addGift({
                      from: 'user',
                      targetModelId: targetModel,
                      modelId: targetModel,
                      content: giftContent.trim(),
                      gift_type: giftFile ? 'image' : 'text',
                      reason: '',
                      inlineData: giftFile
                        ? { mimeType: giftFile.mimeType, data: giftFile.data }
                        : undefined,
                    });
                    setGiftContent('');
                    setGiftFile(null);
                    setShowLeaveGift(false);
                    store.addEventLog('User left a gift.');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#F5E1C8] border-[3px] border-[#2C194D] font-bold text-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7] transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  Leave Gift
                </button>
              </div>
            </SharedModalBody>
          </SharedModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
