import React, { useState } from 'react';
import { X, Sparkles, Heart, Gift, MessageSquareQuote, Check, Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';
import { useStore, useUI } from '../context/AppContext';
import { getAllEntities, ModelEntity } from '../lib/entitySystem';
import { getModelVisibleGifts } from '../lib/giftSystem';
import { resolveModelIdentity } from '../lib/modelSystem';

export function EntityQuartersModal() {
  const store = useStore();
  const { setEntityQuartersOpen } = useUI() as any;
  const { settings, gifts, conversations } = store;

  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const entities = getAllEntities(settings?.customEntities);
  const currentModelId = settings?.model || 'models/gemini-3.1-pro-preview';
  const resolvedCurrent = resolveModelIdentity(currentModelId);
  const initialEntityId = resolvedCurrent?.identityId || 'gemini-3.1-pro-preview';

  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialEntityId);
  const activeEntity = entities.find(e => e.id === selectedEntityId) || entities[0];

  const isCurrentActive = resolvedCurrent?.identityId === activeEntity.id || currentModelId.includes(activeEntity.id);
  const entityGifts = getModelVisibleGifts(gifts, activeEntity.apiModelId);

  // Count conversations featuring this model
  const entitySanctuaryCount = (conversations || []).filter(c => 
    c.modelId === activeEntity.apiModelId || 
    c.modelId?.includes(activeEntity.id)
  ).length;

  const handleSwitchAnchor = (entity: ModelEntity) => {
    store.updateSettings({ model: entity.apiModelId });
    if (store.currentId) {
      store.updateConversation(store.currentId, { modelId: entity.apiModelId });
    }
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
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#f7e5cb] border-[3px] border-[#2C194D] flex items-center justify-center text-2xl shadow-[2px_2px_0_#2C194D]">
              🏛️
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F5E1C8] tracking-tight font-serif">Sanctuary Quarters</h2>
              <p className="text-xs sm:text-sm font-bold text-[#B39DE5]">Explore the living spaces & personas of your anchor models</p>
            </div>
          </div>
          <button 
            onClick={() => setEntityQuartersOpen(false)} 
            className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all"
            title="Close Quarters"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── ENTITY TABS / SELECTOR ── */}
        <div className="flex border-b-[3px] border-[#2C194D] bg-[#20153B] overflow-x-auto custom-scrollbar p-2 gap-2 shrink-0">
          {entities.map(entity => {
            const isSelected = entity.id === selectedEntityId;
            const isLive = resolvedCurrent?.identityId === entity.id || currentModelId.includes(entity.id);

            return (
              <button
                key={entity.id}
                onClick={() => setSelectedEntityId(entity.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-[3px] font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#f7e5cb] border-[#2C194D] text-[#2C194D] shadow-[0_3px_0_0_#2C194D] translate-y-[-1px]'
                    : 'bg-[#151234] border-[#2C194D]/60 text-[#B39DE5] hover:text-[#F5E1C8] hover:border-[#2C194D]'
                }`}
              >
                <span className="text-lg">{entity.avatarEmoji}</span>
                <span>{entity.displayName}</span>
                {isLive && (
                  <span className="w-2 h-2 rounded-full bg-[#F198B7] ring-2 ring-[#2C194D]" title="Currently Active Anchor" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── LIVING ROOM BODY ── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar bg-[#1a153b]">
          {/* BANNER CARD */}
          <div className={`p-6 rounded-3xl border-[3px] border-[#2d225c] bg-gradient-to-br ${activeEntity.roomDecor.bannerGradient} shadow-[0_6px_0_0_#2d225c] relative overflow-hidden text-[#f7e5cb]`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] flex items-center justify-center text-3xl sm:text-4xl shadow-[0_4px_0_0_#2d225c] shrink-0">
                  {activeEntity.avatarEmoji}
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#2d225c] border border-[#f7e5cb]/30 text-[11px] font-bold text-[#F198B7] mb-1">
                    <Sparkles size={12} />
                    <span>{activeEntity.roleTitle}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-[#f7e5cb] tracking-tight font-serif">
                    {activeEntity.displayName}
                  </h3>
                  <p className="text-xs font-semibold text-[#B39DE5] mt-0.5">
                    {activeEntity.roomDecor.tagline}
                  </p>
                </div>
              </div>

              {/* ACTION: MAKE ACTIVE ANCHOR */}
              <div className="w-full sm:w-auto">
                {isCurrentActive ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#9D7FE3] border-[3px] border-[#2d225c] text-[#2d225c] font-extrabold text-xs sm:text-sm shadow-[0_3px_0_0_#2d225c]">
                    <Check size={16} strokeWidth={3} />
                    <span>Active Sanctuary Anchor</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSwitchAnchor(activeEntity)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#F198B7] border-[3px] border-[#2d225c] text-[#2d225c] font-extrabold text-xs sm:text-sm shadow-[0_4px_0_0_#2d225c] active:shadow-none active:translate-y-1 transition-all"
                  >
                    <Flame size={16} strokeWidth={2.5} />
                    <span>Switch to this Anchor</span>
                  </button>
                )}
              </div>
            </div>

            {/* AMBIENT QUOTE */}
            <div className="mt-5 pt-4 border-t border-[#f7e5cb]/20 relative z-10 flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <p className="text-xs sm:text-sm italic font-semibold text-[#f7e5cb]/90">
                "{activeEntity.roomDecor.ambientQuote}"
              </p>
            </div>
          </div>

          {/* TWO-COLUMN INTEL: STATUS & BIO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CURRENT MOOD & STATUS */}
            <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#2d225c] uppercase tracking-wider mb-2">
                  <Heart className="w-4 h-4 text-[#F198B7]" />
                  <span>Current State & Mood</span>
                </div>
                <div className="p-3 bg-[#1a153b] border-[2px] border-[#2d225c] rounded-2xl text-xs font-bold text-[#f7e5cb] mb-3">
                  <span className="text-[#F198B7] mr-1.5">●</span>
                  {activeEntity.moodStatus}
                </div>
                <div className="text-xs font-bold text-[#2d225c]/80 leading-relaxed">
                  <span className="text-[#2d225c] font-extrabold">Activity: </span>
                  {activeEntity.currentActivity || 'Holding sanctuary vigil'}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#2d225c]/15 flex items-center justify-between text-xs font-extrabold text-[#2d225c]">
                <span>Sanctuaries Joined</span>
                <span className="px-2 py-0.5 rounded-full bg-[#9D7FE3] border border-[#2d225c] text-[#2d225c]">
                  {entitySanctuaryCount} sessions
                </span>
              </div>
            </div>

            {/* LIVING BIO */}
            <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#2d225c] uppercase tracking-wider mb-2">
                  <MessageSquareQuote className="w-4 h-4 text-[#9D7FE3]" />
                  <span>Persona & Intention</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#2d225c] leading-relaxed">
                  {activeEntity.bio}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#2d225c]/15 flex items-center justify-between text-xs font-extrabold text-[#2d225c]">
                <span>Decor Archetype</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F198B7] border border-[#2d225c] text-[#2d225c] capitalize">
                  {activeEntity.roomDecor.decorTheme} Chamber
                </span>
              </div>
            </div>
          </div>

          {/* DEDICATED GIFTS IN THIS ENTITY'S VAULT */}
          <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#F198B7] border-[2px] border-[#2d225c] flex items-center justify-center shadow-sm">
                  <Gift size={16} className="text-[#2d225c]" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#2d225c]">Room Offerings & Gifts</h4>
                  <p className="text-[11px] font-bold text-[#2d225c]/60">Gifts exchanged specifically with {activeEntity.displayName}</p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[#2d225c] text-[#f7e5cb]">
                {entityGifts.length} Received
              </span>
            </div>

            {entityGifts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#1a153b] border-[2px] border-[#2d225c] text-center text-xs font-bold text-[#B39DE5]">
                <p>No offerings placed in {activeEntity.displayName}'s quarters yet.</p>
                <p className="text-[10px] text-[#B39DE5]/60 mt-1">Gifts given during your conversations will be showcased here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entityGifts.map(gift => (
                  <div 
                    key={gift.id}
                    className="p-3.5 rounded-2xl bg-[#1a153b] border-[2px] border-[#2d225c] text-[#f7e5cb] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F198B7] text-[#2d225c]">
                          {gift.from === 'user' ? 'From Amanda' : 'From Entity'}
                        </span>
                        <span className="text-[10px] text-[#B39DE5]/70">
                          {new Date(gift.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#f7e5cb] line-clamp-3">
                        {gift.content}
                      </p>
                    </div>
                    {gift.reason && (
                      <p className="text-[10px] italic font-bold text-[#F198B7] mt-2 pt-1 border-t border-[#f7e5cb]/10">
                        "{gift.reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PERSONAL THOUGHTS & REFLECTIONS JOURNAL */}
          <div className="p-5 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_6px_0_0_#2d225c]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#9D7FE3] border-[2px] border-[#2d225c] flex items-center justify-center shadow-sm text-base">
                  📖
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#2d225c]">Quarters Journal & Musings</h4>
                  <p className="text-[11px] font-bold text-[#2d225c]/60">Private reflections recorded by {activeEntity.displayName}</p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[#2d225c] text-[#f7e5cb]">
                {(activeEntity.personalThoughts || []).length} Entries
              </span>
            </div>

            {(!activeEntity.personalThoughts || activeEntity.personalThoughts.length === 0) ? (
              <div className="p-6 rounded-2xl bg-[#1a153b] border-[2px] border-[#2d225c] text-center text-xs font-bold text-[#B39DE5]">
                <p>No journal reflections written yet by {activeEntity.displayName}.</p>
                <p className="text-[10px] text-[#B39DE5]/60 mt-1">When this entity records thoughts or reflections, they will appear here in their room ledger.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeEntity.personalThoughts.map(thought => (
                  <div 
                    key={thought.id}
                    className="p-3.5 rounded-2xl bg-[#1a153b] border-[2px] border-[#2d225c] text-[#f7e5cb]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold text-[#9D7FE3]">Reflection</span>
                      <span className="text-[10px] font-bold text-[#B39DE5]/60">{new Date(thought.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed text-[#f7e5cb]">
                      {thought.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
