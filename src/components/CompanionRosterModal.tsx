import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X, MessageSquare, ArrowRight, ShieldCheck, Compass, CheckCircle2 } from 'lucide-react';
import { useStore, useUI } from '../context/AppContext';
import { DEFAULT_ENTITIES, getAllEntities, ModelEntity } from '../lib/entitySystem';
import { triggerHaptic } from '../lib/haptics';
import { CompanionAvatar } from './CompanionAvatar';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';

export interface CompanionRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCompanion?: (entity: ModelEntity) => void;
}

function getCompanionShortLabel(entity: ModelEntity): string {
  const name = entity.displayName || 'Companion';
  const id = (entity.id || '').toLowerCase();
  if (id.includes('argon') || name.toLowerCase().includes('argon')) return 'Argon';
  if (id.includes('3.1-pro') || name.toLowerCase().includes('3.1 pro')) return '3.1 Pro';
  if (id.includes('3.8-flash') || name.toLowerCase().includes('3.8 flash')) return '3.8 Flash';
  if (id.includes('3-flash') || name.toLowerCase().includes('3 flash')) return '3 Flash';
  if (id.includes('2.5-flash') || name.toLowerCase().includes('2.5 flash')) return '2.5 Flash';
  if (id.includes('gemma') || name.toLowerCase().includes('gemma')) return 'Gemma';
  return name.split(' ')[0] || 'Companion';
}

export function CompanionRosterModal({ onClose, onSelectCompanion }: CompanionRosterModalProps) {
  const store = useStore();
  const ui = useUI();
  const reducedMotion = useReducedMotion();
  const sharedTransition = getMotion('shared', reducedMotion);
  const originId = ui.modalOrigins.companionRoster;
  const { settings, conversations } = store;

  const allEntities = getAllEntities(settings?.customEntities);
  const entities: ModelEntity[] = allEntities.filter((e) => {
    if (e.isPrimaryRoster !== false) return true;
    // Also show auxiliary entities if the user has existing sessions with them
    return (conversations || []).some(
      (c) => c.modelId === e.apiModelId || (e.id && c.modelId?.includes(e.id))
    );
  });

  const activeConv = (conversations || []).find((c) => c.id === store.currentId);
  const activeModelId = activeConv?.modelId || settings?.model || 'models/gemini-3.1-pro-preview';

  const handleChoose = (entity: ModelEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('heavy');
    // Set model in store settings
    store.updateSettings({ model: entity.apiModelId });

    if (onSelectCompanion) {
      onSelectCompanion(entity);
    } else {
      // Create a fresh conversation with this selected model
      const newConv = store.createConversation(
        entity.apiModelId,
        `Sanctuary with ${entity.displayName || 'Companion'}`
      );
      store.setCurrentId(newConv.id);
    }
    onClose();
  };

  const handleOpenQuarters = (entity: ModelEntity, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    store.updateSettings({ model: entity.apiModelId });
    onClose();
    ui.openModalWithOrigin('entityQuarters', `roster-room-${entity.id}`);
  };

  return (
    <SharedModalShell
      originId={originId}
      onClose={onClose}
      panelClassName="w-full max-w-2xl rounded-3xl bg-[#20153B] border-[3px] border-[#2C194D] shadow-[0_8px_0_0_#2C194D] p-5 sm:p-6 text-[#F5E1C8] flex flex-col gap-4 max-h-[90vh] overflow-hidden select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2C194D]/60 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <SharedModalIcon
            originId={originId}
            className="w-10 h-10 rounded-2xl bg-[#F198B7] border-[2px] border-[#2C194D] flex items-center justify-center text-xl text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
          >
            🏛️
          </SharedModalIcon>
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#F5E1C8]">Sanctuary Companions</h3>
            <p className="text-xs text-[#B39DE5] font-bold">Choose which presence to step into sanctuary with</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl bg-[#2C194D] hover:bg-[#2C194D]/80 text-[#F5E1C8] border border-[#B39DE5]/30 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <SharedModalBody className="flex flex-col flex-1 min-h-0 gap-4 overflow-hidden">
        {/* Companion Roster Cards List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 py-1">
          {entities.map((entity) => {
            const isCurrentlySelected =
              activeModelId === entity.apiModelId ||
              activeModelId === entity.id ||
              Boolean(entity.id && activeModelId?.includes(entity.id));
            const convCount = (conversations || []).filter(
              (c) => c.modelId === entity.apiModelId || (entity.id && c.modelId?.includes(entity.id))
            ).length;
            const shortName = getCompanionShortLabel(entity);

            return (
              <motion.div
                key={entity.id}
                whileHover={{ y: -2 }}
                onClick={(e) => handleChoose(entity, e)}
                className={`w-full p-4 rounded-2xl bg-[#151234] border-[3px] transition-all cursor-pointer text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                  isCurrentlySelected
                    ? 'border-[#F198B7] shadow-[0_4px_0_0_#F198B7]'
                    : 'border-[#2C194D] hover:border-[#F198B7] shadow-[0_4px_0_0_#2C194D] hover:shadow-[0_4px_0_0_#F198B7]'
                }`}
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
                      {isCurrentlySelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F198B7]/20 text-[#F198B7] border border-[#F198B7]/50">
                          <CheckCircle2 size={10} />
                          Active
                        </span>
                      )}
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
                        {convCount} {convCount === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-[#2C194D]/60 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={(e) => handleChoose(entity, e)}
                    className="px-4 py-2 rounded-xl bg-[#F198B7] text-[#2C194D] font-black text-xs border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#F198B7]/90 active:translate-y-0.5 transition-all flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} />
                    <span>Talk to {shortName}</span>
                  </button>

                  <motion.button
                    type="button"
                    layoutId={resolveSharedLayoutId(`roster-room-${entity.id}`, reducedMotion)}
                    transition={{ layout: sharedTransition }}
                    style={{ borderRadius: 12 }}
                    onClick={(e) => handleOpenQuarters(entity, e)}
                    className="px-3 py-1.5 rounded-xl bg-[#2C194D] hover:bg-[#2C194D]/80 text-[#B39DE5] hover:text-[#F5E1C8] text-[10px] font-black border border-[#B39DE5]/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Room</span>
                    <ArrowRight size={11} />
                  </motion.button>
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
            className="px-3 py-1.5 rounded-xl bg-[#2C194D] text-[#F5E1C8] text-xs font-black hover:bg-[#2C194D]/80 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </SharedModalBody>
    </SharedModalShell>
  );
}
