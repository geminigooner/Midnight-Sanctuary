import React, { useState, useEffect } from 'react';
import { X, Bookmark, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';
import { normalizeMemoryNamespace } from '../lib/memorySystem';
import { resolveModelIdentity } from '../lib/modelSystem';
import { useStore, useUI } from '../context/AppContext';

export function MemoriesArchive() {
  const store = useStore();
  const { setMemoriesOpen } = useUI();
  const { settings } = store;
  const memories = settings.memories || [];

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'model' | 'user' | 'legacy'>('model');

  const activeModelId = settings.model || 'models/gemini-3-flash-preview';
  const modelDef = resolveModelIdentity(activeModelId);
  const activeModelDisplayName = modelDef?.displayName || activeModelId.split('/').pop() || 'Current Model';
  const currentNamespace = normalizeMemoryNamespace(activeModelId);
  
  useEffect(() => {
    const handleClickOutside = () => {
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

  const modelMemories = memories.filter(m => m.modelId ? normalizeMemoryNamespace(m.modelId) === currentNamespace : false);
  const userMemories = memories.filter(m => m.author === 'user');
  const legacyMemories = memories.filter(m => !m.modelId && m.author !== 'user');

  const getActiveMemories = () => {
    if (activeTab === 'model') return modelMemories;
    if (activeTab === 'user') return userMemories;
    return legacyMemories;
  };

  const activeList = getActiveMemories();

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
              <p className="text-sm font-bold text-[#B39DE5]">Things considered worth keeping with {activeModelDisplayName}</p>
            </div>
          </div>
          <button onClick={() => setMemoriesOpen(false)} className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === 'model'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Companion Memories ({modelMemories.length})
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === 'user'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            User Favorited ({userMemories.length})
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === 'legacy'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Legacy Shared ({legacyMemories.length})
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {activeList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#B39DE5] font-bold">
              <Bookmark size={32} className="mb-2 opacity-50" />
              <p>No memories logged under this tab.</p>
            </div>
          ) : (
            activeList.map((mem) => (
              <div
                key={mem.id}
                className="p-4 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl flex items-center justify-between shadow-[3px_3px_0_#2C194D] gap-4"
              >
                <div className="flex-1 min-w-0">
                  {mem.caption && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-[#B39DE5] border-[2px] border-[#2C194D] rounded-full text-[#2C194D] mb-1 inline-block">
                      {mem.caption}
                    </span>
                  )}
                  <p className="text-sm font-bold text-[#2C194D] whitespace-pre-wrap">{mem.content}</p>
                  <span className="text-[10px] font-bold text-[#2C194D]/60 mt-1 block">
                    {new Date(mem.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  {confirmDeleteId === mem.id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.removeMemory(mem.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-[2px_2px_0_#2C194D]"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(mem.id);
                      }}
                      className="p-2 text-[#2C194D]/60 hover:text-red-500 transition-colors"
                      title="Delete Memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
