import React, { useState } from 'react';
import { Conversation } from '../lib/types';
import { MessageSquare, Trash2, Edit2, Check, X, Plus, Search, List, Orbit } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { NebulaArchive } from './NebulaArchive';
import { getMotion } from '../lib/motion';

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  currentModel: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isOpen: boolean;
}

export function Sidebar({ conversations, currentId, currentModel, onSelect, onNew, onDelete, onRename, isOpen }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'nebula'>('list');

  const filtered = conversations.filter(c => 
    (c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())))
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
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className={`flex flex-col h-full bg-[#151234] border-r-[3px] border-[#2C194D] w-full relative`}>
      <div className="p-4 border-b-[3px] border-[#2C194D] flex flex-col gap-3 z-10 shrink-0">
        <button 
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all text-[#2C194D] font-bold text-lg tracking-tight"
        >
          <Plus size={18} />
          <span>New Sanctuary</span>
        </button>

        <div className="flex bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
          >
            <List size={14} /> List
          </button>
          <button 
            onClick={() => setViewMode('nebula')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'nebula' ? 'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent'}`}
          >
            <Orbit size={14} /> Nebula
          </button>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={viewMotion}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="p-3 border-b-[3px] border-[#2C194D] relative z-10 shrink-0">
              <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-[#2C194D]/50" strokeWidth={3} />
              <input 
                type="text" 
                placeholder="Search memories..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl pl-10 pr-4 py-2.5 text-base font-bold focus:outline-none focus:shadow-[2px_2px_0_#2C194D] text-[#2C194D] placeholder-[#2C194D]/40 transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              <AnimatePresence>
                {filtered.map(c => (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={listMotion}
                    className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${currentId === c.id ? 'bg-[#F5E1C8] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]' : 'hover:bg-[#B39DE5] border-[3px] border-transparent hover:border-[#2C194D] hover:shadow-[2px_2px_0_#2C194D]'}`}
                    onClick={() => onSelect(c.id)}
                  >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <MessageSquare size={16} className="text-[#2C194D] shrink-0" strokeWidth={currentId === c.id ? 2.5 : 2} />
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                        <input 
                          autoFocus
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit()}
                          className="bg-white border-[2px] border-[#2C194D] rounded-xl px-2 py-1 text-base w-full outline-none text-[#2C194D] font-bold"
                        />
                        <button onClick={saveEdit} className="p-1 hover:text-green-600 text-[#2C194D]"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-600 text-[#2C194D]"><X size={14} /></button>
                      </div>
                    ) : (
                      <span className="truncate text-sm font-bold text-[#2C194D]">{c.title}</span>
                    )}
                  </div>
                  
                  {editingId !== c.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => startEdit(c)} className="p-1.5 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl text-[#2C194D] transition-all"><Edit2 size={14} /></button>
                      <button onClick={() => {
                        if (window.confirm('Delete this sanctuary?')) onDelete(c.id);
                      }} className="p-1.5 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl text-[#2C194D] transition-all"><Trash2 size={14} /></button>
                    </div>
                  )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="nebula"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={viewMotion}
            className="flex-1 flex overflow-hidden"
          >
            <NebulaArchive conversations={conversations} currentId={currentId} onSelect={onSelect} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
