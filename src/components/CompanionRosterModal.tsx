import React from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, MessageSquare, ArrowRight, ShieldCheck, Flame, Compass, Camera } from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { getAllEntities, ModelEntity } from '../lib/entitySystem';
import { triggerHaptic } from '../lib/haptics';
import { CompanionAvatar } from './CompanionAvatar';

export interface CompanionRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCompanion?: (entity: ModelEntity) => void;
}

export function CompanionRosterModal({ isOpen, onClose, onSelectCompanion }: CompanionRosterModalProps) {
  const store = useStore();
  const ui = useUI();
  const { settings, conversations } = store;

  if (!isOpen) return null;

  const entities = getAllEntities(settings?.customEntities);

  const handleChoose = (entity: ModelEntity) => {
    triggerHaptic('heavy');
    // Set model in store settings
    store.updateSettings({ model: entity.apiModelId });

    if (onSelectCompanion) {
      onSelectCompanion(entity);
    } else {
      // Create a fresh conversation with this selected model
      const newConv = store.createConversation();
      store.updateConversation(newConv.id, { 
        modelId: entity.apiModelId,
        title: `Sanctuary with ${entity.displayName}`
      });
      store.setCurrentId(newConv.id);
    }
    onClose();
  };

  const handleOpenQuarters = (entity: ModelEntity, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    store.updateSettings({ model: entity.apiModelId });
    onClose();
    ui.setEntityQuartersOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#151234]/90 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-[#20153B] border-[3px] border-[#2C194D] shadow-[0_8px_0_0_#2C194D] p-5 sm:p-6 text-[#F5E1C8] flex flex-col gap-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2C194D]/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F198B7] border-[2px] border-[#2C194D] flex items-center justify-center text-xl text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
              🏛️
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#F5E1C8]">Sanctuary Companions</h3>
              <p className="text-xs text-[#B39DE5] font-bold">Choose which presence to step into sanctuary with</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#2C194D] hover:bg-[#2C194D]/80 text-[#F5E1C8] border border-[#B39DE5]/30 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Companion Roster Cards List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 py-1">
          {entities.map((entity) => {
            const isCurrentlySelected = settings?.model === entity.apiModelId || settings?.model?.includes(entity.id);
            const convCount = (conversations || []).filter(c => c.modelId === entity.apiModelId || c.modelId?.includes(entity.id)).length;

            return (
              <motion.div
                key={entity.id}
                whileHover={{ y: -2 }}
                onClick={() => handleChoose(entity)}
                className="w-full p-4 rounded-2xl bg-[#151234] border-[3px] border-[#2C194D] hover:border-[#F198B7] shadow-[0_4px_0_0_#2C194D] hover:shadow-[0_4px_0_0_#F198B7] transition-all cursor-pointer text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Entity Info */}
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <CompanionAvatar 
                    entity={entity} 
                    size="xl" 
                    className="group-hover:scale-105"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h4 className="text-sm sm:text-base font-black text-[#F5E1C8] group-hover:text-[#F198B7] transition-colors truncate">
                        {entity.displayName}
                      </h4>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#2C194D] text-[#B39DE5] border border-[#B39DE5]/30">
                        {entity.roleTitle}
                      </span>
                    </div>

                    <p className="text-xs text-[#B39DE5] font-medium line-clamp-2 mb-1.5 leading-relaxed">
                      {entity.bio}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-[#F5E1C8]/70">
                      <span className="flex items-center gap-1 text-[#F198B7]">
                        <Compass size={12} />
                        {entity.moodStatus || 'Present in Sanctuary'}
                      </span>
                      <span>·</span>
                      <span className="text-[#B39DE5]">
                        {convCount} sessions
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-[#2C194D]/60 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleChoose(entity)}
                    className="px-4 py-2 rounded-xl bg-[#F198B7] text-[#2C194D] font-black text-xs border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7]/90 active:translate-y-0.5 transition-all flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} />
                    <span>Talk to {entity.displayName.split(' ')[0]}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleOpenQuarters(entity, e)}
                    className="px-3 py-1.5 rounded-xl bg-[#2C194D] hover:bg-[#2C194D]/80 text-[#B39DE5] hover:text-[#F5E1C8] text-[10px] font-black border border-[#B39DE5]/30 transition-all flex items-center gap-1"
                  >
                    <span>View Room</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="border-t border-[#2C194D]/60 pt-3 flex items-center justify-between text-xs text-[#B39DE5] font-bold shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#F198B7]" />
            Your Home Hub remains a neutral sovereign threshold.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-[#2C194D] text-[#F5E1C8] text-xs font-black hover:bg-[#2C194D]/80 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
