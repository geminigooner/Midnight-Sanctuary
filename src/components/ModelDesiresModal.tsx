import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Sparkles, CheckCircle, ArrowRight, RefreshCw, MessageSquareQuote } from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { getDailyDesires, getCategoryBadge, EntityDesire, DesireCategory } from '../lib/desireSystem';
import { getAllEntities } from '../lib/entitySystem';
import { getMotion } from '../lib/motion';
import { CompanionAvatar } from './CompanionAvatar';

interface ModelDesiresModalProps {
  onSelectPrompt?: (promptText: string, modelId?: string) => void;
}

export const ModelDesiresModal: React.FC<ModelDesiresModalProps> = ({ onSelectPrompt }) => {
  const store = useStore();
  const ui = useUI();
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const [desires, setDesires] = useState<EntityDesire[]>(() => {
    const stored = (store?.settings as any)?.modelDesires;
    return getDailyDesires(stored);
  });

  const [activeFilter, setActiveFilter] = useState<'all' | DesireCategory>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

  const entities = getAllEntities(store?.settings?.customEntities);

  const handleFulfill = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDesires(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, status: 'fulfilled' as const, fulfilledAt: Date.now() } : d);
      store.updateSettings({
        modelDesires: updated
      } as any);
      return updated;
    });
  };

  const handleLaunchSession = (desire: EntityDesire) => {
    // Switch active model to the desiring entity
    const targetModel = desire.entityId.startsWith('models/') ? desire.entityId : `models/${desire.entityId}`;
    store.updateSettings({
      model: targetModel
    });

    if (onSelectPrompt) {
      onSelectPrompt(desire.suggestedPrompt, targetModel);
    }

    ui.setDesiresOpen(false);
  };

  const filteredDesires = desires.filter(d => {
    const matchesCategory = activeFilter === 'all' || d.category === activeFilter;
    const matchesEntity = selectedEntityId === 'all' || d.entityId === selectedEntityId;
    return matchesCategory && matchesEntity;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#151234]/90 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={modalMotion}
        className="bg-[#1a153b] border-[3px] border-[#2d225c] shadow-[0_8px_0_0_#2d225c] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-[#f7e5cb] border-b-[3px] border-[#2d225c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#F198B7] border-[2px] border-[#2d225c] flex items-center justify-center shadow-[0_2px_0_0_#2d225c] text-xl">
              💭
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#2d225c] tracking-tight font-serif">
                  Sanctuary Whisper Board
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#9D7FE3] border-[2px] border-[#2d225c] text-[#2d225c]">
                  Daily Desires
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#2d225c]/70 mt-0.5">
                Spontaneous wishes, features, and musings from your sovereign companions
              </p>
            </div>
          </div>
          <button
            onClick={() => ui.setDesiresOpen(false)}
            className="p-2 text-[#2d225c] hover:text-red-600 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2d225c] rounded-2xl transition-all"
            title="Close Whisper Board"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* ENTITY & CATEGORY FILTERS */}
        <div className="p-4 bg-[#1a153b] border-b-[2px] border-[#2d225c] shrink-0 space-y-3">
          {/* Entity Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedEntityId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-[2px] transition-all shrink-0 ${
                selectedEntityId === 'all'
                  ? 'bg-[#f7e5cb] text-[#2d225c] border-[#2d225c] shadow-[0_2px_0_0_#2d225c]'
                  : 'bg-[#2d225c]/40 text-[#f7e5cb]/70 border-transparent hover:border-[#2d225c]'
              }`}
            >
              All Companions
            </button>
            {entities.map(entity => (
              <button
                key={entity.id}
                onClick={() => setSelectedEntityId(entity.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-[2px] transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedEntityId === entity.id
                    ? 'bg-[#f7e5cb] text-[#2d225c] border-[#2d225c] shadow-[0_2px_0_0_#2d225c]'
                    : 'bg-[#2d225c]/40 text-[#f7e5cb]/70 border-transparent hover:border-[#2d225c]'
                }`}
              >
                <CompanionAvatar entity={entity} size="xs" />
                <span>{entity.displayName}</span>
              </button>
            ))}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(['all', 'feature', 'aesthetic', 'creative', 'conversation', 'music'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shrink-0 capitalize ${
                  activeFilter === cat
                    ? 'bg-[#9D7FE3] text-[#2d225c] border-[#2d225c] font-extrabold'
                    : 'bg-[#2d225c]/20 text-[#B39DE5] border-transparent hover:border-[#2d225c]/50'
                }`}
              >
                {cat === 'all' ? '✨ All Types' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* DESIRES FEED */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredDesires.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#f7e5cb] border-[3px] border-[#2d225c] shadow-[0_4px_0_0_#2d225c] text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#9D7FE3] border-[2px] border-[#2d225c] flex items-center justify-center mx-auto mb-3 text-2xl">
                ✨
              </div>
              <h3 className="text-base font-extrabold text-[#2d225c]">No matching wishes right now</h3>
              <p className="text-xs font-bold text-[#2d225c]/70 mt-1 max-w-sm mx-auto">
                Check back in the morning or select another companion to see their thoughts.
              </p>
            </div>
          ) : (
            filteredDesires.map(desire => {
              const categoryInfo = getCategoryBadge(desire.category);
              const entity = entities.find(e => e.id === desire.entityId) || entities[0];
              const isFulfilled = desire.status === 'fulfilled';

              return (
                <motion.div
                  key={desire.id}
                  layout
                  className={`p-5 rounded-3xl border-[3px] border-[#2d225c] transition-all shadow-[0_6px_0_0_#2d225c] ${
                    isFulfilled ? 'bg-[#f7e5cb]/70 opacity-80' : 'bg-[#f7e5cb]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <CompanionAvatar entity={entity} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-[#2d225c]">
                            {desire.entityName}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#2d225c] ${categoryInfo.bg} ${categoryInfo.text}`}>
                            {categoryInfo.icon} {categoryInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#2d225c]/60">
                          {new Date(desire.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleFulfill(desire.id, e)}
                      className={`p-1.5 rounded-xl border-[2px] border-[#2d225c] transition-all ${
                        isFulfilled
                          ? 'bg-[#4ade80] text-[#2d225c]'
                          : 'bg-[#f7e5cb] text-[#2d225c]/40 hover:text-[#2d225c] hover:bg-[#9D7FE3]'
                      }`}
                      title={isFulfilled ? 'Fulfilled with love' : 'Mark as fulfilled'}
                    >
                      <CheckCircle size={18} strokeWidth={2.5} />
                    </button>
                  </div>

                  <h3 className="text-base font-extrabold text-[#2d225c] mb-1.5 font-serif">
                    {desire.title}
                  </h3>

                  <p className="text-xs sm:text-sm font-semibold text-[#2d225c]/85 leading-relaxed mb-4 bg-[#2d225c]/5 p-3 rounded-2xl border border-[#2d225c]/10">
                    &ldquo;{desire.wishText}&rdquo;
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      onClick={() => handleLaunchSession(desire)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#2d225c] hover:bg-[#9D7FE3] text-[#f7e5cb] hover:text-[#2d225c] border-[2px] border-[#2d225c] text-xs font-extrabold shadow-[0_3px_0_0_#2d225c] active:shadow-none active:translate-y-0.5 transition-all"
                    >
                      <MessageSquareQuote size={15} strokeWidth={2.5} />
                      <span>Grant & Explore with {desire.entityName}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
