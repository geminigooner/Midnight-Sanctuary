import React, { useState, useEffect, useMemo } from 'react';
import { X, Bookmark, Trash2, Lock, Unlock } from 'lucide-react';
import {
  combineIsolatedMemories,
  getLegacyMemories,
  getModelMemories,
  getUserMemories,
} from '../lib/memorySystem';
import { getModelEntity } from '../lib/entitySystem';
import { formatPostedTimestamp } from '../lib/types';
import { useStore, useUI } from '../context/AppContext';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';

export function MemoriesArchive() {
  const store = useStore();
  const { closeModal, modalOrigins } = useUI();
  const originId = modalOrigins.memories;
  const { settings } = store;

  const memories = useMemo(() => {
    const combined = combineIsolatedMemories(
      store.sharedMemories || [],
      store.companionMemories || {}
    );
    return combined.length > 0 ? combined : settings.memories || [];
  }, [store.sharedMemories, store.companionMemories, settings.memories]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'model' | 'user' | 'legacy'>('model');

  const activeConv = store.conversations.find(c => c.id === store.currentId);
  const activeModelId = activeConv?.modelId || settings.model || 'models/gemini-3.1-pro-preview';
  const activeEntity = getModelEntity(activeModelId, settings.customEntities);
  const activeModelDisplayName = activeEntity.displayName || activeModelId?.split('/').pop() || 'Current Model';
  const userDisplayName = store.profile?.name?.trim() || 'Amanda';
  
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

  const modelMemories = useMemo(
    () => getModelMemories(memories, activeEntity.id),
    [memories, activeEntity.id]
  );
  const userMemories = useMemo(() => getUserMemories(memories), [memories]);
  const legacyMemories = useMemo(
    () => getLegacyMemories(memories, activeEntity.id),
    [memories, activeEntity.id]
  );

  const getActiveMemories = () => {
    if (activeTab === 'model') return modelMemories;
    if (activeTab === 'user') return userMemories;
    return legacyMemories;
  };

  const activeList = getActiveMemories();

  return (
    <SharedModalShell
      originId={originId}
      onClose={() => closeModal('memories')}
      panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col relative overflow-hidden"
    >
      <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
        <div className="flex items-center gap-3">
          <SharedModalIcon
            originId={originId}
            className="w-12 h-12 rounded-2xl bg-[#9D7FE3] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
          >
            <Bookmark size={20} />
          </SharedModalIcon>
          <div>
            <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Memories Archive</h2>
            <p className="text-sm font-bold text-[#B39DE5]">Things considered worth keeping with {activeModelDisplayName}</p>
          </div>
        </div>
        <button
          onClick={() => closeModal('memories')}
          className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      <SharedModalBody className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'model'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            Companion Memories ({modelMemories.length})
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'user'
                ? 'bg-[#F198B7] text-[#2C194D]'
                : 'text-[#B39DE5] hover:text-[#F5E1C8]'
            }`}
          >
            User Favorited ({userMemories.length})
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`flex-1 py-3 px-4 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${
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
            activeList.map((mem) => {
              const isCompanionAuthor =
                mem.author === 'model' ||
                mem.origin === 'tool' ||
                mem.origin === 'save_memory';
              const memEntity = getModelEntity(
                mem.modelId || activeEntity.id,
                settings.customEntities
              );
              const whoPosted = isCompanionAuthor
                ? `${memEntity?.avatarEmoji || '✦'} ${memEntity?.displayName || activeModelDisplayName}`
                : `💖 ${userDisplayName} (You)`;
              const whatPosted = mem.isLocked
                ? 'Locked Core Anchor'
                : activeTab === 'model'
                ? `Private Memory (${activeModelDisplayName})`
                : 'Shared Sanctuary Memory';

              return (
              <div
                key={mem.id}
                className={`p-4 bg-[#F5E1C8] border-[3px] ${mem.isLocked ? 'border-[#9D7FE3] shadow-[4px_4px_0_#9D7FE3]' : 'border-[#2C194D] shadow-[3px_3px_0_#2C194D]'} rounded-2xl flex items-center justify-between gap-4`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-[#2C194D]/15 text-[11px] font-bold text-[#2C194D]/80 tabular-nums">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-[#2C194D]">
                        Posted by {whoPosted}
                      </span>
                      <span>·</span>
                      <span className="text-[#2C194D]/75">{whatPosted}</span>
                      {mem.isLocked && (
                        <span className="text-[10px] font-extrabold text-[#2C194D] inline-flex items-center gap-0.5">
                          · <Lock size={10} strokeWidth={3} /> Locked
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-[#2C194D]/65">
                      {formatPostedTimestamp(mem.createdAt)}
                    </span>
                  </div>
                  {mem.caption && (
                    <div className="text-xs font-extrabold text-[#2C194D]/80 mb-1">
                      {mem.caption}
                    </div>
                  )}
                  <p className="text-sm font-bold text-[#2C194D] whitespace-pre-wrap">{mem.content}</p>
                  {mem.lockReason && (
                    <p className="text-xs font-semibold text-[#2C194D]/80 italic mt-1 bg-[#2C194D]/5 p-1.5 rounded-lg border border-[#2C194D]/15">
                      🔒 &ldquo;{mem.lockReason}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mem.isLocked) {
                        store.unlockMemory(mem.id);
                      } else {
                        store.lockMemory(mem.id, 'User locked anchor');
                      }
                    }}
                    className={`p-2 rounded-xl border-[2px] border-transparent hover:border-[#2C194D] transition-colors ${mem.isLocked ? 'text-[#9D7FE3] hover:bg-[#9D7FE3]/20' : 'text-[#2C194D]/50 hover:text-[#2C194D]'}`}
                    title={mem.isLocked ? "Unlock Memory" : "Lock Memory as Anchor"}
                  >
                    {mem.isLocked ? <Lock size={16} strokeWidth={2.5} /> : <Unlock size={16} />}
                  </button>

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
              );
            })
          )}
        </div>
      </SharedModalBody>
    </SharedModalShell>
  );
}
