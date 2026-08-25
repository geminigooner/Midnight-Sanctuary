import React, { useState, useEffect, useRef } from 'react';
import { Memory } from '../lib/types';
import { X, Bookmark, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';

interface MemoriesArchiveProps {
  memories: Memory[];
  onClose: () => void;
  onRemoveMemory?: (id: string) => void;
  currentModel?: string;
}

export function MemoriesArchive({ memories, onClose, onRemoveMemory, currentModel }: MemoriesArchiveProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'model' | 'user' | 'legacy'>('model');
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setConfirmDeleteId(null);
    };
    if (confirmDeleteId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [confirmDeleteId]);
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  return (
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
              <Bookmark size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Memories Archive</h2>
              <p className="text-sm font-bold text-[#B39DE5]">Things you considered worth keeping</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap ${activeTab === 'model' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}`}
          >
            Model Memories
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap ${activeTab === 'user' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}`}
          >
            User Saved
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap ${activeTab === 'legacy' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}`}
          >
            Legacy / Unassigned
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {(() => {
            const displayMemories = memories.filter(m => {
              const isExplicitUser = m.author === 'user' || m.origin === 'user_favorited' || m.origin === 'user_saved';
              const isExplicitModel = m.author === 'model' || m.origin === 'gemma_initiated';
              
              if (activeTab === 'user') {
                return isExplicitUser;
              }
              
              if (activeTab === 'model') {
                return isExplicitModel && m.modelId === currentModel;
              }
              
              // legacy tab
              if (isExplicitModel && m.modelId !== currentModel) {
                // Another model's memory (also fits in legacy/unassigned for this view, or we can just say "unassigned")
                // Wait, if it belongs to another model, it shouldn't be under legacy/unassigned, but for now we put it there so it's not hidden.
                return true; 
              }
              if (!isExplicitUser && !isExplicitModel) {
                return true; // True legacy without enough metadata
              }
              if (isExplicitModel && !m.modelId) {
                return true; // Model memory without modelId
              }
              return false;
            });

            if (displayMemories.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-[#B39DE5] font-bold space-y-4 min-h-[40vh]">
                  <Bookmark size={48} className="opacity-20" />
                  <p className="tracking-widest uppercase text-sm">No memories in this tab.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMemories.map(memory => (
                <div key={memory.id} className="bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-5 hover:shadow-[4px_4px_0_#2C194D] transition-colors flex flex-col gap-3 group relative">
                  
                  {onRemoveMemory && (
                    <div className="absolute top-2 right-2">
                      {confirmDeleteId === memory.id ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveMemory(memory.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-400/10 rounded"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                          className="p-1.5 text-[#2C194D]/40 hover:text-red-600 transition-all rounded-xl hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] opacity-100"
                          title="Delete memory"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 text-[#2C194D] prose prose-p:leading-relaxed prose-sm max-w-none pt-2">
                    {memory.caption && (
                      <div className="text-xs text-[#F198B7] font-bold mb-2 uppercase tracking-wide">
                        {memory.caption}
                      </div>
                    )}
                    {memory.content}
                  </div>
                  
                  <div className="flex justify-between items-end mt-2 pt-3 border-t-[3px] border-[#2C194D] border-dashed">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#F198B7] uppercase tracking-widest font-bold bg-[#2C194D] px-2 py-1 rounded w-max">
                        {(() => {
                           const isExplicitUser = memory.author === 'user' || memory.origin === 'user_favorited' || memory.origin === 'user_saved';
                           const isExplicitModel = memory.author === 'model' || memory.origin === 'gemma_initiated';
                           if (isExplicitUser) return 'User Saved';
                           if (isExplicitModel) return memory.modelId ? `Model: ${memory.modelId}` : 'Model: Unknown';
                           return 'Legacy / Unassigned';
                        })()}
                      </span>
                      <span className="text-[10px] text-[#B39DE5] font-bold">
                        {new Date(memory.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                  </div>
                </div>
              ))}
            </div>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
}
