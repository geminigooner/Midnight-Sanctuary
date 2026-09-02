import React, { useState } from 'react';
import { X, Gift, Sparkles, Tag, Plus } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { getMotion } from '../lib/motion';
import { getModelVisibleGifts, getLegacyOrOtherModelGifts, normalizeModelNamespace } from '../lib/giftSystem';
import { resolveModelIdentity } from '../lib/modelSystem';
import { useStore, useUI } from '../context/AppContext';
import { ScribbleCard } from './ScribbleCard';
import { MusicGiftCard } from './MusicGiftCard';
import { PlacedSticker } from '../lib/stickerSystem';
import { StickerBadge } from './CraftStickerModal';

export function GiftsArchive() {
  const store = useStore();
  const { setGiftsOpen, setStickerChestOpen } = useUI();
  const { gifts, settings } = store;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'all'>('current');
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const activeModelId = settings.model || 'models/gemini-3-flash-preview';
  const modelDef = resolveModelIdentity(activeModelId);
  const activeModelDisplayName = modelDef?.displayName || activeModelId.split('/').pop() || 'Current Model';

  const currentModelGifts = getModelVisibleGifts(gifts, activeModelId);
  const otherGifts = getLegacyOrOtherModelGifts(gifts, activeModelId);

  const displayGifts = activeTab === 'current' ? currentModelGifts : otherGifts;
  const placedStickers: PlacedSticker[] = settings.placedStickers || [];
  const stickersList = settings.stickers || [];

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={modalMotion}
          className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col relative overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
                <Gift size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Gifts Archive</h2>
                <p className="text-sm font-bold text-[#B39DE5]">Moments held onto with {activeModelDisplayName}</p>
              </div>
            </div>
            <button onClick={() => setGiftsOpen(false)} className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
                activeTab === 'current'
                  ? 'bg-[#F198B7] text-[#2C194D]'
                  : 'text-[#B39DE5] hover:text-[#F5E1C8]'
              }`}
            >
              Current Model Gifts ({currentModelGifts.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
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
                  if (gift.gift_type === 'svg_scribble' || gift.scribble) {
                    const scribbleData = gift.scribble || {
                      id: gift.id,
                      title: gift.content || 'Hand-Drawn Scribble',
                      description: gift.content,
                      svgMarkup: gift.content.startsWith('<svg') ? gift.content : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="#2C194D" stroke-width="4" fill="none"/></svg>',
                      reason: gift.reason,
                      authorModelId: gift.modelId,
                      timestamp: gift.timestamp
                    };
                    return (
                      <ScribbleCard 
                        key={gift.id} 
                        scribble={scribbleData} 
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
                      timestamp: gift.timestamp,
                    };
                    return (
                      <MusicGiftCard
                        key={gift.id}
                        track={musicData}
                        isCompact={true}
                      />
                    );
                  }

                  const giftStickers = placedStickers.filter(p => p.targetId === `gift:${gift.id}`);

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
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-[#B39DE5] border-[2px] border-[#2C194D] rounded-full text-[#2C194D]">
                            {gift.from === 'user' ? 'From You' : 'From Companion'}
                          </span>
                          <span className="text-[10px] font-bold text-[#2C194D]/60">
                            {new Date(gift.timestamp).toLocaleDateString()}
                          </span>
                        </div>

                        {gift.inlineData && (
                          <img
                            src={`data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`}
                            alt="Gift attachment"
                            onClick={() => setSelectedImage(`data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`)}
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

                        <button
                          onClick={() => setStickerChestOpen(true)}
                          className="px-2 py-1 rounded-lg bg-[#2C194D]/10 hover:bg-[#2C194D] text-[#2C194D] hover:text-[#F5E1C8] text-[10px] font-black flex items-center gap-1 transition-colors"
                          title="Stick seal onto this gift"
                        >
                          <Tag size={10} />
                          <span>Stick Badge</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#151234]/95 backdrop-blur-md cursor-pointer"
          >
            <button className="absolute top-6 right-6 p-2 text-[#2C194D] hover:text-white transition-colors bg-white/10 rounded-full">
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage}
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
