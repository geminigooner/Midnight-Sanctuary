import React, { useState } from 'react';
import { Presence, PresenceState } from './Presence';
import { Menu, Terminal, MoreVertical, X, Gift, Download, Bookmark, User, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, useUI } from '../context/AppContext';
import { Conversation } from '../lib/types';

export interface ChatHeaderProps {
  conversation: Conversation;
  presence: PresenceState;
  visibleMessagesCount: number;
  onExportMarkdown: () => void;
}

export function ChatHeader({
  conversation,
  presence,
  visibleMessagesCount,
  onExportMarkdown,
}: ChatHeaderProps) {
  const store = useStore();
  const ui = useUI();
  const { settings, availableModels } = store;

  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const modelsList = Array.isArray(availableModels) ? availableModels : [];
  const currentModelDisplayName = modelsList.find(m => m.name === settings.model)?.displayName || settings.model?.split('/').pop() || 'Unknown Model';

  return (
    <div className="flex items-center justify-between p-2 m-2 sm:m-3 border-[3px] border-[#2C194D] rounded-[32px] bg-[#9D7FE3] relative z-30 shrink-0 min-w-0 shadow-[4px_4px_0px_#2C194D]">
      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 px-1">
        <button 
          onClick={() => ui.setSidebarOpen(prev => !prev)} 
          className="w-12 h-12 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 lg:hidden shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all"
        >
          <Menu size={24} strokeWidth={2.5} />
        </button>
        <Presence state={presence} />
        
        <div className="flex-1 flex items-center justify-center min-w-0">
          <div className="flex flex-col items-center min-w-0 w-full max-w-[280px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#F5E1C8]">✨</span>
              <span className="font-bold text-[#2C194D] text-lg sm:text-xl tracking-tight">Midnight Sanctuary</span>
              <span className="text-[#F5E1C8]">✨</span>
            </div>
            <div className="relative bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-full px-4 py-1.5 w-full flex justify-between items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.05)] text-sm overflow-hidden">
              <select 
                value={settings.model} 
                onChange={(e) => {
                  store.updateSettings({ model: e.target.value });
                  if (conversation) {
                    store.updateConversation(conversation.id, { modelId: e.target.value });
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              >
                {modelsList.map(m => (
                  <option key={m.name} value={m.name}>{m.displayName}</option>
                ))}
                {settings.model && !modelsList.find(m => m.name === settings.model) && (
                  <option key={settings.model} value={settings.model}>{settings.model.split('/').pop()}</option>
                )}
              </select>
              <span className="text-[#2C194D] font-bold truncate pointer-events-none">
                ✨ {currentModelDisplayName}
              </span>
              <svg className="pointer-events-none shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div className="flex justify-between w-full px-2 mt-1 text-[10px] sm:text-xs font-bold text-[#2C194D]/70 uppercase tracking-widest">
              <span>Temp {settings.temperature.toFixed(1)}</span>
              <span className="text-[#F198B7]">•</span>
              <span>Msgs {conversation.messages.length} / {visibleMessagesCount}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 px-1 relative">
        <button 
          onClick={() => setShowMobileMenu(!showMobileMenu)} 
          className="w-12 h-12 flex sm:hidden items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all"
        >
          <MoreVertical size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => setShowDevPanel(!showDevPanel)} 
          className="hidden sm:flex w-12 h-12 items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all" 
          title="Developer Details"
        >
          <Terminal size={20} strokeWidth={2.5} />
        </button>
        
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-3 w-56 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-3 shadow-[6px_6px_0_#2C194D] z-50 text-base flex flex-col gap-2 max-w-[calc(100vw-1.5rem)]"
            >
              <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45"></div>
              <button onClick={() => { setShowMobileMenu(false); setShowDevPanel(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Terminal size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Developer</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setGiftsOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Gift size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Gifts</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setJewelOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <span className="flex-1 font-bold">Jewel</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); onExportMarkdown(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Download size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Export</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setMemoriesOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Bookmark size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Memories</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setProfileOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><User size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Profile</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setSettingsOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><SettingsIcon size={18} strokeWidth={2.5} /></div>
                <span className="flex-1 font-bold">Settings</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showDevPanel && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-3 w-64 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-4 shadow-[6px_6px_0_#2C194D] z-50 text-sm max-w-[calc(100vw-1.5rem)] text-[#2C194D]"
            >
              <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45 hidden sm:block"></div>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center border-b-[3px] border-[#2C194D] pb-2">
                  <span className="font-bold text-lg">Developer Details</span>
                  <button onClick={() => setShowDevPanel(false)} className="bg-[#F198B7] border-[3px] border-[#2C194D] rounded-lg p-1 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all"><X size={14} strokeWidth={3} /></button>
                </div>
                
                <div className="space-y-2 text-xs font-bold">
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Provider</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">Google</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Model ID</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]" title={settings.model}>{settings.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Endpoint</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]">/api/chat</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Temperature</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">{settings.temperature.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Streaming</span>
                    <span className="bg-[#F198B7] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">Enabled</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
