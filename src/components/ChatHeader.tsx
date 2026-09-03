import React, { useState } from 'react';
import { Presence, PresenceState } from './Presence';
import { Menu, Terminal, MoreVertical, X, Gift, Download, Bookmark, User, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, useUI } from '../context/AppContext';
import { Conversation } from '../lib/types';
import { resolveModelIdentity } from '../lib/modelSystem';
import { getAllEntities } from '../lib/entitySystem';

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
  const { settings } = store;

  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const activeModelId = conversation?.modelId || settings?.model || 'models/gemini-3.1-pro-preview';
  const entities = getAllEntities(settings?.customEntities);
  const resolved = resolveModelIdentity(activeModelId);
  const companion = entities.find(e => e.id === resolved?.identityId || e.apiModelId === activeModelId) || entities[0];

  return (
    <div className="flex items-center justify-between p-2 m-2 sm:m-3 border-[3px] border-[#2C194D] rounded-[28px] sm:rounded-[32px] bg-[#9D7FE3] relative z-30 shrink-0 min-w-0 shadow-[4px_4px_0px_#2C194D]">
      {/* Left Navigation Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button 
          onClick={() => ui.setSidebarOpen(prev => !prev)} 
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 lg:hidden shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all"
          title="Open Menu"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => store.setCurrentId(null)}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all text-base"
          title="Return to Sanctuary Home Hub"
        >
          🏠
        </button>
        <div className="hidden sm:flex">
          <Presence state={presence} />
        </div>
      </div>
      
      {/* Center: Clean Companion Identity Banner */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-1.5">
        <button
          onClick={() => ui.setEntityQuartersOpen(true)}
          className="flex items-center gap-2 px-3 py-1 sm:py-1.5 rounded-2xl bg-[#F5E1C8] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#FAF0E4] active:translate-y-0.5 transition-all max-w-[210px] sm:max-w-xs min-w-0 group"
          title="View Companion Quarters & Room"
        >
          <div 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-2 border-[#2C194D] flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden shadow-xs"
            style={{ backgroundColor: companion?.themeColor || '#9D7FE3' }}
          >
            {companion?.avatarUrl ? (
              <img 
                src={companion.avatarUrl} 
                alt={companion.displayName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <span>{companion?.avatarEmoji || '🔮'}</span>
            )}
          </div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-extrabold text-[#2C194D] text-xs sm:text-sm truncate leading-tight">
                {companion?.displayName || 'Companion'}
              </span>
              <span className="text-[10px] text-[#F198B7] shrink-0">✦</span>
            </div>
            <span className="text-[10px] text-[#2C194D]/75 font-semibold truncate leading-none">
              {companion?.roleTitle || 'Sanctuary Anchor'}
            </span>
          </div>
        </button>
      </div>
      
      {/* Right Actions & Account */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => ui.setAuthModalOpen(true)}
          className={`h-10 sm:h-11 px-2.5 sm:px-3 flex items-center justify-center border-[3px] border-[#2C194D] rounded-2xl shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all ${
            store.user 
              ? 'bg-[#F5E1C8] text-[#2C194D]' 
              : 'bg-[#F198B7] text-[#2C194D] animate-pulse'
          }`}
          title={store.user ? `Signed in as ${store.user.email}` : 'Sign In with Google'}
        >
          {store.user?.photoURL ? (
            <img 
              src={store.user.photoURL} 
              alt={store.user.displayName || 'User'} 
              className="w-5 h-5 rounded-full border border-[#2C194D] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ShieldCheck size={18} strokeWidth={2.5} />
          )}
          <span className="hidden md:inline-block ml-1.5 text-xs font-extrabold truncate max-w-[90px]">
            {store.user ? (store.user.displayName?.split(' ')[0] || 'Auth') : 'Sign In'}
          </span>
        </button>

        <button 
          onClick={() => setShowMobileMenu(!showMobileMenu)} 
          className="w-10 h-10 sm:w-11 sm:h-11 flex sm:hidden items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all"
        >
          <MoreVertical size={20} strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => setShowDevPanel(!showDevPanel)} 
          className="hidden sm:flex w-11 h-11 items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all" 
          title="Developer Details"
        >
          <Terminal size={18} strokeWidth={2.5} />
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
              <button onClick={() => { setShowMobileMenu(false); ui.setAuthModalOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">{store.user ? 'Account / Auth' : 'Sign In with Google'}</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button onClick={() => { setShowMobileMenu(false); ui.setEntityQuartersOpen(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                <div className="w-10 h-10 bg-[#f7e5cb] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0 text-base">🏛️</div>
                <span className="flex-1 font-bold">Quarters</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
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
                    <span className="text-[#2C194D]/70">Companion</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]">{companion?.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Model ID</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]" title={settings.model}>{settings.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Messages</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">{conversation?.messages?.length || 0}</span>
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
