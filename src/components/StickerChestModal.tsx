import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2, Check, Tag } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';
import { useStore, useUI } from '../context/AppContext';
import { INITIAL_STICKER_CHEST, SanctuarySticker, PlacedSticker } from '../lib/stickerSystem';
import { getAllEntities } from '../lib/entitySystem';
import { triggerHaptic } from '../lib/haptics';

export function StickerChestModal() {
  const store = useStore();
  const ui = useUI();
  const { settings } = store;

  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const [activeCategory, setActiveCategory] = useState<'all' | 'cyber' | 'cozy' | 'celestial' | 'anchor' | 'fraud_ops'>('all');
  const [selectedSticker, setSelectedSticker] = useState<SanctuarySticker | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<string>('gemini-3.1-pro-preview');
  const [justPlaced, setJustPlaced] = useState(false);

  const stickers: SanctuarySticker[] = settings?.stickers || INITIAL_STICKER_CHEST;
  const placedStickers: PlacedSticker[] = settings?.placedStickers || [];
  const entities = getAllEntities(settings?.customEntities);

  const filteredStickers = activeCategory === 'all' 
    ? stickers 
    : stickers.filter(s => s.category === activeCategory);

  const handlePlaceSticker = () => {
    if (!selectedSticker) return;
    (store as any).placeSticker({
      stickerId: selectedSticker.id,
      emoji: selectedSticker.emoji,
      name: selectedSticker.name,
      targetId: targetEntityId,
      placedBy: 'user',
    });
    triggerHaptic('medium');
    setJustPlaced(true);
    setTimeout(() => {
      setJustPlaced(false);
    }, 1500);
  };

  const handleRemovePlaced = (placedId: string) => {
    (store as any).removePlacedSticker(placedId);
    triggerHaptic('light');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#151234]/90 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={modalMotion}
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col relative overflow-hidden"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-2xl shadow-[2px_2px_0_#2C194D]">
              🏷️
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F5E1C8] tracking-tight font-serif">Sanctuary Sticker Chest</h2>
              <p className="text-xs sm:text-sm font-bold text-[#B39DE5]">Tactile seals, badges & room decoratives</p>
            </div>
          </div>
          <button
            onClick={() => ui.setStickerChestOpen(false)}
            className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all"
            title="Close Chest"
          >
            <X size={20} />
          </button>
        </div>

        {/* CATEGORY FILTERS */}
        <div className="flex border-b-[3px] border-[#2C194D] bg-[#20153B] overflow-x-auto custom-scrollbar p-2 gap-2 shrink-0">
          {(['all', 'anchor', 'fraud_ops', 'cyber', 'celestial', 'cozy'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl border-[2px] font-extrabold text-xs capitalize transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-[#f7e5cb] border-[#2C194D] text-[#2C194D] shadow-[0_2px_0_0_#2C194D]'
                  : 'bg-[#151234] border-[#2C194D]/60 text-[#B39DE5] hover:text-[#F5E1C8]'
              }`}
            >
              {cat === 'all' ? '✨ All Seals' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* MAIN BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar bg-[#1a153b]">
          {/* STICKER GRID */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#B39DE5] mb-3 flex items-center gap-1.5">
              <Sparkles size={13} /> Collectible Seals ({filteredStickers.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filteredStickers.map(sticker => {
                const isSelected = selectedSticker?.id === sticker.id;
                const placedCount = placedStickers.filter(p => p.stickerId === sticker.id).length;

                return (
                  <button
                    key={sticker.id}
                    onClick={() => {
                      setSelectedSticker(sticker);
                      triggerHaptic('light');
                    }}
                    className={`p-3 rounded-2xl border-[3px] flex flex-col items-center text-center transition-all ${
                      isSelected
                        ? 'bg-[#f7e5cb] border-[#2C194D] shadow-[0_4px_0_0_#2C194D] translate-y-[-2px]'
                        : 'bg-[#151234] border-[#2C194D]/70 hover:border-[#2C194D] text-[#F5E1C8]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#2C194D]/20 border border-[#2C194D]/30 flex items-center justify-center text-3xl mb-2">
                      {sticker.emoji}
                    </div>
                    <span className={`text-xs font-black truncate w-full ${isSelected ? 'text-[#2C194D]' : 'text-[#F5E1C8]'}`}>
                      {sticker.name}
                    </span>
                    <p className={`text-[10px] line-clamp-2 mt-1 leading-snug ${isSelected ? 'text-[#2C194D]/80 font-bold' : 'text-[#B39DE5]/80'}`}>
                      {sticker.description}
                    </p>
                    {placedCount > 0 && (
                      <span className="mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#F198B7] text-[#2C194D] border border-[#2C194D]">
                        {placedCount} placed
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PLACEMENT CONTROLS */}
          {selectedSticker && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2C194D] shadow-[0_4px_0_0_#2C194D] text-[#2C194D]"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedSticker.emoji}</span>
                  <div>
                    <h4 className="text-sm font-black text-[#2C194D]">Affix {selectedSticker.name}</h4>
                    <p className="text-xs font-bold text-[#2d225c]/80">Select where you want to stick this seal:</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={targetEntityId}
                    onChange={(e) => setTargetEntityId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border-[2px] border-[#2C194D] text-xs font-black text-[#2C194D] outline-none shadow-[2px_2px_0_#2C194D]"
                  >
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.avatarEmoji} {e.displayName}&apos;s Quarters
                      </option>
                    ))}
                    <option value="user_dossier">📁 User Dossier</option>
                  </select>

                  <button
                    onClick={handlePlaceSticker}
                    className="px-4 py-2 rounded-xl bg-[#F198B7] hover:bg-[#ff85ac] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 active:shadow-none text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    {justPlaced ? <Check size={14} className="text-green-800" /> : <Plus size={14} />}
                    <span>{justPlaced ? 'Affixed!' : 'Stick Now'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTIVE PLACED STICKERS DRAWER */}
          {placedStickers.length > 0 && (
            <div className="border-t-[2px] border-[#2C194D] pt-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#B39DE5] mb-3 flex items-center gap-1.5">
                <Tag size={13} /> Active Placements ({placedStickers.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {placedStickers.map(placed => {
                  const targetEntity = entities.find(e => e.id === placed.targetId);
                  const targetLabel = targetEntity ? `${targetEntity.displayName}'s Room` : 'User Dossier';

                  return (
                    <div
                      key={placed.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#20153B] border-[2px] border-[#2C194D] text-[#F5E1C8]"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-xl">{placed.emoji}</span>
                        <div className="truncate">
                          <span className="text-xs font-black truncate block">{placed.name}</span>
                          <span className="text-[10px] font-bold text-[#B39DE5]">on {targetLabel}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePlaced(placed.id)}
                        className="p-1.5 text-[#B39DE5] hover:text-red-400 hover:bg-[#2C194D] rounded-lg transition-colors"
                        title="Remove seal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
