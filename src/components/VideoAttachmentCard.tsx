import React, { useState, useEffect } from 'react';
import { VideoAttachmentMeta, formatPostedTimestamp } from '../lib/types';
import {
  Play,
  Film,
  Lock,
  Users,
  Share2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Volume2,
  Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatVideoDurationLabel } from '../lib/media/videoProcessor';
import { useStore } from '../context/AppContext';
import { getSharedPersistenceCoordinator } from '../lib/store';
import { triggerHaptic } from '../lib/haptics';

export interface VideoAttachmentCardProps {
  video: VideoAttachmentMeta;
  companionName?: string;
  companionEntityId?: string;
  postedByName?: string;
  postedAt?: number;
  onImageClick?: (url: string) => void;
}

export function VideoAttachmentCard({
  video,
  companionName = 'Companion',
  postedByName,
  postedAt,
  onImageClick,
}: VideoAttachmentCardProps) {
  const store = useStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(
    video.downloadUrl || null
  );
  const [showSensoryDetails, setShowSensoryDetails] = useState(false);
  const [sharedToPool, setSharedToPool] = useState(video.scope === 'shared');
  const [captionText, setCaptionText] = useState(video.caption || '');
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState(video.caption || '');

  useEffect(() => {
    if (video.caption !== undefined) {
      setCaptionText(video.caption);
      setDraftCaption(video.caption);
    }
  }, [video.caption]);

  useEffect(() => {
    let active = true;
    if (video.downloadUrl) {
      setResolvedVideoUrl(video.downloadUrl);
      return;
    }
    if (video.mediaAssetId) {
      void (async () => {
        try {
          const coord = getSharedPersistenceCoordinator();
          const uid = coord.getDomainState().uid || '__local_unauthenticated__';
          const blob = await coord.getVault().getMediaBlob(uid, video.mediaAssetId!);
          if (active && blob?.dataUrl && blob.dataUrl.startsWith('data:video/')) {
            setResolvedVideoUrl(blob.dataUrl);
          }
        } catch {
          // fallback to poster + storyboard
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [video.downloadUrl, video.mediaAssetId]);

  const durationLabel = formatVideoDurationLabel(video.durationSec);
  const sizeMb = video.byteSize ? (video.byteSize / (1024 * 1024)).toFixed(1) : null;
  const resolvedPosterName =
    postedByName || video.contributedByName || store.profile?.name || 'You';
  const resolvedPostedAt = postedAt || video.createdAt;

  const handleSaveCaption = (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    triggerHaptic('light');
    const trimmed = draftCaption.trim();
    setCaptionText(trimmed);
    setIsEditingCaption(false);
    const vaultId = video.vaultItemId || video.id;
    const targetScope = sharedToPool ? 'shared' : (video.scope || 'private');
    if (vaultId && (store as any).vault?.updateAsset) {
      void (store as any).vault.updateAsset(
        targetScope,
        vaultId,
        { caption: trimmed },
        video.ownerEntityId
      );
    }
  };

  const handlePromoteToSharedPool = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    if (sharedToPool) return;
    if (video.vaultItemId && video.ownerEntityId && (store as any).promoteVaultItemToShared) {
      (store as any).promoteVaultItemToShared(video.ownerEntityId, video.vaultItemId);
    } else if ((store as any).addVaultItem) {
      (store as any).addVaultItem({
        id: video.vaultItemId || video.id,
        scope: 'shared',
        ownerEntityId: video.ownerEntityId,
        contributedByType: 'user',
        contributedByName: store.profile?.name || 'You',
        mediaCategory: 'video',
        title: video.fileName || 'Shared Sanctuary Video',
        caption: captionText || video.caption || video.mediaDigest,
        mimeType: video.mimeType,
        mediaAssetId: video.mediaAssetId,
        downloadUrl: resolvedVideoUrl || video.downloadUrl,
        posterDataUrl: video.posterDataUrl,
        durationSec: video.durationSec,
        byteSize: video.byteSize,
        keyframes: video.keyframes,
        geminiFileUri: video.geminiFileUri,
        geminiFileExpiresAt: video.geminiFileExpiresAt,
        acousticTranscript: video.acousticTranscript,
        mediaDigest: video.mediaDigest,
      });
    }
    setSharedToPool(true);
  };

  return (
    <div className="mt-3 w-full max-w-[440px] rounded-2xl bg-[#151234] border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D] overflow-hidden text-[#F5E1C8] select-none">
      {/* Header bar with Who Posted What & When */}
      <div className="px-3 py-2 bg-[#1F173A] border-b-[2px] border-[#2C194D] space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Film size={14} className="text-[#F198B7] shrink-0" />
            <span className="text-xs font-extrabold text-[#F5E1C8] truncate">
              {video.fileName || 'Sanctuary Video Clip'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sharedToPool ? (
              <span className="inline-flex items-center gap-1 text-[#81E6D9] text-[10px] font-black">
                <Users size={10} />
                <span>Shared Pool</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#F198B7] text-[10px] font-black">
                <Lock size={10} />
                <span>Private Vault</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-bold text-[#B39DE5]/90 tabular-nums">
          <span>
            Posted by <strong className="text-[#F5E1C8] font-black">{resolvedPosterName}</strong> · Video Clip
          </span>
          {resolvedPostedAt ? (
            <span className="text-[#B39DE5]/75">{formatPostedTimestamp(resolvedPostedAt)}</span>
          ) : null}
        </div>
      </div>

      {/* Main Cinema Stage */}
      <div className="relative w-full aspect-video bg-[#0B081D] overflow-hidden flex items-center justify-center">
        {isPlaying && resolvedVideoUrl ? (
          <video
            src={resolvedVideoUrl}
            poster={video.posterDataUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <>
            {video.posterDataUrl ? (
              <img
                src={video.posterDataUrl}
                alt={video.fileName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1E163B] to-[#0D0A1C] text-[#B39DE5]">
                <Film size={32} />
              </div>
            )}

            {/* Contrast Scrim for Overlaid Controls & Duration */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

            {/* Play or Storyboard Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                if (resolvedVideoUrl) {
                  setIsPlaying(true);
                } else {
                  setShowSensoryDetails((prev) => !prev);
                }
              }}
              className="relative z-10 w-14 h-14 rounded-2xl bg-[#F5E1C8]/95 hover:bg-[#F198B7] text-[#2C194D] border-[3px] border-[#2C194D] shadow-[3px_3px_0_#2C194D] flex items-center justify-center active:translate-y-0.5 transition-all cursor-pointer"
              title={resolvedVideoUrl ? 'Play Video' : 'Inspect Storyboard & Audio Score'}
            >
              <Play size={24} className="fill-current ml-0.5" />
            </button>

            {/* Bottom Overlay Metadata */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[#F5E1C8] text-[11px] font-black tabular-nums">
                  {durationLabel}
                </span>
                {sizeMb && (
                  <span className="px-2 py-0.5 rounded-md bg-black/60 text-[#B39DE5] text-[10px] font-bold tabular-nums">
                    {sizeMb} MB
                  </span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-md bg-black/70 border border-[#F198B7]/30 text-[#F198B7] text-[10px] font-extrabold flex items-center gap-1">
                <Sparkles size={10} />
                <span>
                  {video.geminiFileUri && (video.durationSec || 0) <= 600
                    ? 'Native .MP4 Video + Audio'
                    : `${video.keyframes?.length || 1} Frames + Audio Bridge`}
                </span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Caption Bar (View / Inline Add or Edit Caption) */}
      <div className="px-3 py-2 bg-[#171233] border-t-[2px] border-[#2C194D]">
        {isEditingCaption ? (
          <form onSubmit={handleSaveCaption} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              placeholder="Write a caption for this video..."
              autoFocus
              className="flex-1 min-w-0 px-2.5 py-1 rounded-xl bg-[#0D0A1C] border-[2px] border-[#2C194D] text-xs font-bold text-[#F5E1C8] placeholder:text-[#B39DE5]/50 focus:outline-none focus:border-[#F198B7]"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-xl bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] text-[10px] font-black cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingCaption(false);
                setDraftCaption(captionText);
              }}
              className="px-2 py-1 rounded-xl bg-[#1F173A] text-[#B39DE5] border border-[#2C194D] text-[10px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : captionText ? (
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-extrabold text-[#F5E1C8] leading-snug break-words">
              <span className="text-[#F198B7] mr-1">💬 Caption:</span>"{captionText}"
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                setDraftCaption(captionText);
                setIsEditingCaption(true);
              }}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1F173A] hover:bg-[#2C194D] text-[#B39DE5] hover:text-[#F5E1C8] text-[10px] font-bold transition-colors cursor-pointer"
              title="Edit video caption"
            >
              <Edit3 size={10} />
              <span>Edit</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              setDraftCaption('');
              setIsEditingCaption(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B39DE5]/80 hover:text-[#F198B7] transition-colors cursor-pointer"
          >
            <Edit3 size={11} />
            <span>+ Add a caption to this video</span>
          </button>
        )}
      </div>

      {/* Action Footer: Sensory Cinema Bridge Drawer + Promote to Shared Pool */}
      <div className="px-3 py-2 bg-[#1A1438] border-t-[2px] border-[#2C194D] flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('light');
            setShowSensoryDetails((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#B39DE5] hover:text-[#F5E1C8] transition-colors cursor-pointer"
        >
          <Volume2 size={13} className="text-[#F198B7]" />
          <span>Sensory Bridge ({companionName})</span>
          {showSensoryDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {!sharedToPool ? (
          <button
            type="button"
            onClick={handlePromoteToSharedPool}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#B39DE5] hover:bg-[#F198B7] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 text-[10px] font-black transition-all cursor-pointer"
            title="Also share this video with all companions in the Shared Sanctuary Pool"
          >
            <Share2 size={11} />
            <span>Share to Shared Pool</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#81E6D9]">
            <Check size={11} />
            <span>In Shared Sanctuary Pool</span>
          </span>
        )}
      </div>

      {/* Collapsible Storyboard Keyframes & Acoustic/Lyric Transcript */}
      <AnimatePresence>
        {showSensoryDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#120E29] border-t-[2px] border-[#2C194D]"
          >
            <div className="p-3 space-y-3">
              {Array.isArray(video.keyframes) && video.keyframes.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#B39DE5] mb-1.5">
                    Timestamped Visual Storyboard ({video.keyframes.length} Keyframes)
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                    {video.keyframes.map((kf, idx) => (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageClick?.(kf.dataUrl);
                        }}
                        className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden border-[2px] border-[#2C194D] cursor-pointer hover:border-[#F198B7] transition-colors"
                      >
                        <img
                          src={kf.dataUrl}
                          alt={`Frame ${kf.timestampLabel}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[#F5E1C8] text-[9px] font-black tabular-nums">
                          {kf.timestampLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {video.acousticTranscript && (
                <div className="p-2.5 rounded-xl bg-[#1B153A] border border-[#2C194D]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#F198B7] mb-1">
                    Time-Coded Acoustic & Lyric Score
                  </div>
                  <p className="text-[11px] font-bold text-[#F5E1C8]/90 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                    {video.acousticTranscript}
                  </p>
                </div>
              )}

              {video.mediaDigest && (
                <div className="p-2.5 rounded-xl bg-[#1B153A]/60 border border-[#2C194D]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#81E6D9] mb-1">
                    Long-Term Media Memory Digest
                  </div>
                  <p className="text-[11px] font-bold text-[#F5E1C8]/85 leading-relaxed">
                    {video.mediaDigest}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
