import React, { useState } from 'react';
import { Conversation } from '../lib/types';
import { Plus, ShieldCheck, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { NebulaArchive } from './NebulaArchive';
import { getMotion } from '../lib/motion';
import { useStore, useUI } from '../context/AppContext';
import { getModelEntity } from '../lib/entitySystem';
import { CompanionAvatar } from './CompanionAvatar';

export function Sidebar() {
  const store = useStore();
  const { setSidebarOpen, setCompanionRosterOpen, setAuthModalOpen } = useUI();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'nebula'>('list');

  const modelConversations = Array.isArray(store.conversations) ? store.conversations : [];
  const filtered = modelConversations.filter(c => 
    c && ((c.title?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (c.messages || []).some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())))
  );

  const reducedMotion = useReducedMotion();
  const listMotion = getMotion('standard', reducedMotion);
  const viewMotion = getMotion('heavy', reducedMotion);

  const startEdit = (c: Conversation) => {
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      store.renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleSelect = (id: string) => {
    const chat = store.conversations.find(c => c.id === id);
    if (chat && chat.modelId) {
      store.updateSettings({ model: chat.modelId });
    }
    store.setCurrentId(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleNew = () => {
    setCompanionRosterOpen(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#151234] border-r-[3px] border-[#2C194D] w-full relative">
      <div className="p-4 border-b-[3px] border-[#2C194D] flex flex-col gap-3 z-10 shrink-0">
        <div className="flex gap-2">
          <button 
            onClick={handleNew}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all text-[#2C194D] font-bold text-base tracking-tight"
          >
            <Plus size={18} />
            <span>New Sanctuary</span>
          </button>
          <button 
            onClick={() => {
              store.setCurrentId(null);
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            title="Return to Sanctuary Home Hub"
            className={`px-3.5 py-3 border-[3px] border-[#2C194D] rounded-[20px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all font-bold text-sm flex items-center justify-center ${store.currentId === null ? 'bg-[#9D7FE3] text-[#2C194D]' : 'bg-[#F5E1C8] text-[#2C194D]'}`}
          >
            🏠
          </button>
        </div>

        <div className="flex bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
          >
            List
          </button>
          <button 
            onClick={() => setViewMode('nebula')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'nebula' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
          >
            Nebula
          </button>
        </div>

        {viewMode === 'list' && (
          <div className="relative">
            <input 
              type="text" 
              placeholder="Filter sanctuary..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl px-4 py-2 text-sm text-[#2C194D] placeholder-[#2C194D]/50 focus:outline-none shadow-[inset_0_2px_0_rgba(0,0,0,0.05)] font-bold"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar z-10">
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div 
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={viewMotion}
              className="space-y-2"
            >
              {filtered.map(c => {
                const isSelected = c.id === store.currentId;
                const isEditing = editingId === c.id;
                const convEntity = getModelEntity(c.modelId || store.settings?.model || 'gemini-3.1-pro-preview', store.settings?.customEntities);

                return (
                  <motion.div 
                    key={c.id} 
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={listMotion}
                    onClick={() => !isEditing && handleSelect(c.id)}
                    className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border-[3px] ${
                      isSelected 
                        ? 'bg-[#B39DE5] border-[#2C194D] shadow-[3px_3px_0_#2C194D]' 
                        : 'bg-[#F5E1C8] border-[#2C194D] hover:bg-[#F5E1C8]/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      <CompanionAvatar entity={convEntity} size="xs" />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="bg-transparent border-b-[2px] border-[#2C194D] text-sm text-[#2C194D] font-bold focus:outline-none w-full"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-sm font-bold text-[#2C194D] truncate block">
                            {c.title || 'Untitled Sanctuary'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isEditing ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                          className="p-1 hover:text-[#2C194D] text-[#2C194D]/70"
                        >
                          ✓
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                            className="p-1 hover:text-[#2C194D] text-[#2C194D]/70"
                          >
                            ✎
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); store.deleteConversation(c.id); }}
                            className="p-1 hover:text-red-500 text-[#2C194D]/70"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="nebula-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={viewMotion}
              className="h-full"
            >
              <NebulaArchive 
                conversations={store.conversations} 
                currentId={store.currentId} 
                onSelect={(id) => {
                  store.setCurrentId(id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sanctuary Auth Badge & Profile Bottom Bar */}
      <div className="p-3 border-t-[3px] border-[#2C194D] bg-[#1a1640] shrink-0 z-10">
        {store.user ? (
          <div 
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#9D7FE3]/20 hover:bg-[#9D7FE3]/30 border-[2px] border-[#2C194D] cursor-pointer transition-all shadow-[2px_2px_0_#2C194D]"
          >
            {store.user.photoURL ? (
              <img
                src={store.user.photoURL}
                alt={store.user.displayName || 'User'}
                className="w-9 h-9 rounded-full border-[2px] border-[#2C194D] object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center font-bold text-xs text-[#2C194D] shrink-0">
                {store.user.displayName?.[0] || store.user.email?.[0] || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-extrabold text-[#F5E1C8] truncate">{store.user.displayName || 'Sanctuary Owner'}</span>
                {store.user.email === 'ahatley094@gmail.com' && (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
                )}
              </div>
              <p className="text-[10px] font-semibold text-[#B39DE5] truncate">{store.user.email}</p>
            </div>
            <div className="w-7 h-7 rounded-xl bg-[#F5E1C8] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shrink-0 shadow-[1px_1px_0_#2C194D]">
              <ShieldCheck size={14} strokeWidth={2.5} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#F198B7] hover:bg-[#eb86aa] border-[2.5px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[0_3px_0_0_#2C194D] active:translate-y-0.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogIn size={15} strokeWidth={2.5} />
            <span>Sign In to Sanctuary</span>
          </button>
        )}
      </div>
    </div>
  );
}
