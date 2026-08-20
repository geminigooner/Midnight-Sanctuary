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
  const [activeTab, setActiveTab] = useState<'model' | 'user'>('model');
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setConfirmDeleteId(null);
    };
    if (confirmDeleteId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [confirmDeleteId]);
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={modalMotion}
        className="bg-ink border border-glass-border rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-glass-border bg-ink/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-glass border border-glass-border flex items-center justify-center text-copper shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
              <Bookmark size={20} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-pearlescent tracking-wide">Memories Archive</h2>
              <p className="text-sm text-mauve">Things you considered worth keeping</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-glass rounded-full transition-colors text-mauve hover:text-champagne">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-glass-border">
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 p-4 text-sm font-medium tracking-wide transition-colors ${activeTab === 'model' ? 'text-copper border-b-2 border-copper bg-white/5' : 'text-mauve hover:text-pearlescent'}`}
          >
            Model Memories
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 p-4 text-sm font-medium tracking-wide transition-colors ${activeTab === 'user' ? 'text-copper border-b-2 border-copper bg-white/5' : 'text-mauve hover:text-pearlescent'}`}
          >
            User Saved Memories
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {(() => {
            const displayMemories = memories.filter(m => {
              const isModelAuthor = m.author === 'model' || m.origin === 'gemma_initiated';
              if (activeTab === 'user') return !isModelAuthor;
              
              // If model tab, filter by current active model.
              // If the memory has no modelId (older memory), let it show up or we can strictly filter.
              // We'll strictly filter if modelId exists, otherwise show it as legacy.
              if (m.modelId) {
                return m.modelId === currentModel;
              }
              return true; // Legacy memories without modelId
            });

            if (displayMemories.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-mauve opacity-50 space-y-4 min-h-[40vh]">
                  <Bookmark size={48} className="opacity-20" />
                  <p className="tracking-widest uppercase text-sm">No memories in this tab.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMemories.map(memory => (
                <div key={memory.id} className="bg-glass border border-glass-border rounded-xl p-5 hover:border-copper/40 transition-colors flex flex-col gap-3 group relative">
                  
                  {onRemoveMemory && (
                    <div className="absolute top-2 right-2">
                      {confirmDeleteId === memory.id ? (
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); onRemoveMemory(memory.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-400/10 rounded"
                        >
                          delete?
                        </button>
                      ) : (
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                          className="p-1 text-mauve hover:text-red-400 transition-colors rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 text-pearlescent prose prose-invert prose-p:leading-relaxed prose-sm max-w-none pt-2">
                    {memory.caption && (
                      <div className="text-xs text-copper/90 font-medium mb-2 opacity-80 uppercase tracking-wide">
                        {memory.caption}
                      </div>
                    )}
                    {memory.content}
                  </div>
                  
                  <div className="flex justify-between items-end mt-2 pt-3 border-t border-glass-border border-dashed">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-copper/80 uppercase tracking-widest font-medium">
                        {memory.author === 'model' ? (memory.modelId || 'From Model') : (memory.origin === 'gemma_initiated' ? 'From Gemma' : 'Recorded')}
                      </span>
                      <span className="text-[10px] text-mauve italic">
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
