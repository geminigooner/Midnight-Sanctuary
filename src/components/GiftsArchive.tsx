import React, { useState } from 'react';
import { X, Gift, Sparkles, Tag, Plus } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';
import { getModelVisibleGifts, getLegacyOrOtherModelGifts } from '../lib/giftSystem';
import { resolveModelIdentity } from '../lib/modelSystem';
import { getModelEntity } from '../lib/entitySystem';
import { formatPostedTimestamp, formatMediaCategoryLabel } from '../lib/types';
import { useStore, useUI } from '../context/AppContext';
import { ScribbleCard } from './ScribbleCard';
import { MusicGiftCard } from './MusicGiftCard';
import { PlacedSticker } from '../lib/stickerSystem';
import { StickerBadge } from './CraftStickerModal';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';

export function GiftsArchive() {
  const store = useStore();
  const { closeModal, openModalWithOrigin, modalOrigins } = useUI();
  const { gifts, settings } = store;

  const [selectedImage, setSelectedImage] = useState<{ id: string; url: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'all'>('current');
  const reducedMotion = useReducedMotion();
  const sharedTransition = getMotion('shared', reducedMotion);
  const originId = modalOrigins.gifts;

  const activeConv = store.conversations.find(c => c.id === store.currentId);
  const activeModelId = activeConv?.modelId || settings.model || 'models/gemini-3.1-pro-preview';
  const modelDef = resolveModelIdentity(activeModelId);
  const activeModelDisplayName = modelDef?.displayName || activeModelId?.split('/').pop() || 'Current Model';
  const userDisplayName = store.profile?.name?.trim() || 'Amanda';

  const currentModelGifts = getModelVisibleGifts(gifts, activeModelId);
  const otherGifts = getLegacyOrOtherModelGifts(gifts, activeModelId);

  const displayGifts = activeTab === 'current' ? currentModelGifts : otherGifts;
  const placedStickers: PlacedSticker[] = settings.placedStickers || [];
  const stickersList = settings.stickers || [];

  return (
    <>
      <SharedModalShell
        originId={originId}
        onClose={() => closeModal('gifts')}
        panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <SharedModalIcon
              originId={originId}
              className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
            >
              <Gift size={20} />
            </SharedModalIcon>
            <div>
              <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Gifts Archive</h2>
              <p className="text-sm font-bold text-[#B39DE5]">Moments held onto with {activeModelDisplayName}</p>
            </div>
          </div>
          <button
            onClick={() => closeModal('gifts')}
            className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <SharedModalBody className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-[#F198B7] text-[#2C194D]'
                  : 'text-[#B39DE5] hover:text-[#F5E1C8]'
              }`}
            >
              Current Model Gifts ({currentModelGifts.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#F198B7] text-[#2C194D]'
                  : 'text-[#B39DE5] hover:text-[#F5E1C8]'
              }`}
            >
              Other Sanctuary Gifts ({otherGifts.length})
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
            {displayGifts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#B39DE5] font-bold">
                <Sparkles size={32} className="mb-2 opacity-50" />
                <p>No gifts collected in this space yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayGifts.map((gift) => {
                  const giftEntity = getModelEntity(
                    gift.modelId || gift.targetModelId || activeModelId,
                    settings.customEntities
                  );
                  const companionLabel = giftEntity?.displayName || activeModelDisplayName;
                  const companionEmoji = giftEntity?.avatarEmoji || '✦';

                  if (gift.gift_type === 'svg_scribble' || gift.scribble) {
                    const scribbleData = gift.scribble || {
                      id: gift.id,
                      title: gift.content || 'Hand-Drawn Scribble',
                      description: gift.content,
                      svgMarkup: gift.content.startsWith('<svg') ? gift.content : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="#2C194D" stroke-width="4" fill="none"/></svg>',
                      reason: gift.reason,
                      authorModelId: gift.modelId,
                      authorDisplayName: companionLabel,
                      timestamp: gift.timestamp
                    };
                    return (
                      <ScribbleCard 
                        key={gift.id} 
                        scribble={{
                          ...scribbleData,
                          authorDisplayName: scribbleData.authorDisplayName || companionLabel,
                          timestamp: scribbleData.timestamp || gift.timestamp,
                        }} 
                        isCompact={true}
                      />
                    );
                  }

                  if (gift.gift_type === 'music_track' || gift.musicTrack) {
                    const musicData = gift.musicTrack || {
                      id: gift.id,
                      title: gift.content || 'Original Melody',
                      description: gift.content,
                      genre: 'lofi_piano',
                      tempo: 85,
                      key: 'C Major',
                      notes: [],
                      reason: gift.reason,
                      authorModelId: gift.modelId,
                      authorDisplayName: companionLabel,
                      timestamp: gift.timestamp,
                    };
                    return (
                      <MusicGiftCard
                        key={gift.id}
                        track={{
                          ...musicData,
                          authorDisplayName: musicData.authorDisplayName || companionLabel,
                          timestamp: musicData.timestamp || gift.timestamp,
                        }}
                        isCompact={true}
                      />
                    );
                  }

                  const giftStickers = placedStickers.filter(p => p.targetId === `gift:${gift.id}`);
                  const isFromUser = gift.from === 'user';
                  const whoPosted = isFromUser
                    ? `💖 ${userDisplayName} (You) for ${companionLabel}`
                    : `${companionEmoji} ${companionLabel} for ${userDisplayName}`;
                  const whatPosted = gift.inlineData
                    ? 'Photo Keepsake'
                    : formatMediaCategoryLabel(gift.gift_type || 'gift');

                  return (
                    <div
                      key={gift.id}
                      className="relative p-4 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl flex flex-col justify-between shadow-[3px_3px_0_#2C194D] overflow-hidden"
                    >
                      {/* Affixed Stickers / Badges on Gift Card */}
                      {giftStickers.length > 0 && (
                        <div className="absolute top-2 right-12 flex items-center gap-1 z-10">
                          {giftStickers.map(gs => {
                            const stickerDef = stickersList.find((s: any) => s.id === gs.stickerId);
                            if (stickerDef) {
                              return (
                                <StickerBadge
                                  key={gs.id}
                                  sticker={stickerDef}
                                  size="sm"
                                  isGlowing={true}
                                />
                              );
                            }
                            return (
                              <span
                                key={gs.id}
                                className="text-base p-1 rounded-lg bg-[#20153B] border border-[#2C194D] shadow-sm animate-pulse"
                                title={`${gs.name} placed by ${gs.placedBy}`}
                              >
                                {gs.emoji}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap justify-between items-center gap-1.5 mb-2 pb-1.5 border-b border-[#2C194D]/15 text-[11px] font-bold text-[#2C194D]/80 tabular-nums">
                          <span>
                            Posted by <strong className="text-[#2C194D] font-black">{whoPosted}</strong> · {whatPosted}
                          </span>
                          <span className="text-[10px] font-bold text-[#2C194D]/65">
                            {formatPostedTimestamp(gift.timestamp)}
                          </span>
                        </div>

                        {gift.inlineData && (
                          <motion.img
                            layoutId={resolveSharedLayoutId(`gift-photo-${gift.id}`, reducedMotion)}
                            transition={{ layout: sharedTransition }}
                            style={{ borderRadius: 12 }}
                            src={`data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`}
                            alt="Gift attachment"
                            onClick={() =>
                              setSelectedImage({
                                id: gift.id,
                                url: `data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`,
                              })
                            }
                            className="w-full h-36 object-cover rounded-xl border-[2px] border-[#2C194D] mb-2 cursor-pointer hover:opacity-95 transition-opacity"
                          />
                        )}

                        <p className="text-sm font-bold text-[#2C194D] whitespace-pre-wrap">{gift.content}</p>
                      </div>

                      <div className="mt-3 border-t border-[#2C194D]/20 pt-2 flex items-center justify-between">
                        {gift.reason ? (
                          <p className="text-xs text-[#2C194D]/70 italic font-bold">
                            &quot;{gift.reason}&quot;
                          </p>
                        ) : <div />}

                        <motion.button
                          layoutId={resolveSharedLayoutId(`gift-card-stick-${gift.id}`, reducedMotion)}
                          transition={{ layout: sharedTransition }}
                          style={{ borderRadius: 8 }}
                          onClick={() => openModalWithOrigin('stickerChest', `gift-card-stick-${gift.id}`)}
                          className="px-2 py-1 rounded-lg bg-[#2C194D]/10 hover:bg-[#2C194D] text-[#2C194D] hover:text-[#F5E1C8] text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                          title="Stick seal onto this gift"
                        >
                          <motion.span
                            layoutId={resolveSharedLayoutId(`gift-card-stick-${gift.id}`, reducedMotion, 'icon')}
                            transition={{ layout: sharedTransition }}
                            className="flex items-center justify-center"
                          >
                            <Tag size={10} />
                          </motion.span>
                          <span>Stick Badge</span>
                        </motion.button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SharedModalBody>
      </SharedModalShell>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#151234]/95 backdrop-blur-md cursor-pointer"
          >
            <button className="absolute top-6 right-6 p-2 text-[#F5E1C8] hover:text-white transition-colors bg-white/10 rounded-full cursor-pointer">
              <X size={24} />
            </button>
            <motion.img
              layoutId={resolveSharedLayoutId(`gift-photo-${selectedImage.id}`, reducedMotion)}
              transition={{ layout: sharedTransition }}
              style={{ borderRadius: 12 }}
              src={selectedImage.url}
              alt="Full size gift"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
