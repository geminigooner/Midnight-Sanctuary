import React, { useState } from 'react';
import { Presence, PresenceState } from './Presence';
import {
  Menu,
  Terminal,
  MoreVertical,
  X,
  Gift,
  Download,
  Bookmark,
  User,
  Settings as SettingsIcon,
  ShieldCheck,
  Gem,
  Tag,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useStore, useUI } from '../context/AppContext';
import { Conversation } from '../lib/types';
import { resolveModelIdentity } from '../lib/modelSystem';
import { getAllEntities } from '../lib/entitySystem';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';
import { SyncStatusBadge } from './SyncStatusBadge';

export interface ChatHeaderProps {
  conversation: Conversation;
  presence: PresenceState;
  visibleMessagesCount: number;
  onExportMarkdown: () => void;
}

export function ChatHeader({
  conversation,
  presence,
  onExportMarkdown,
}: ChatHeaderProps) {
  const store = useStore();
  const ui = useUI();
  const { settings } = store;
  const reducedMotion = useReducedMotion();
  const sharedTransition = getMotion('shared', reducedMotion);

  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const activeModelId = conversation?.modelId || settings?.model || 'models/gemini-3.1-pro-preview';
  const entities = getAllEntities(settings?.customEntities);
  const resolved = resolveModelIdentity(activeModelId);
  const companion =
    entities.find((e) => e.id === resolved?.identityId || e.apiModelId === activeModelId) ||
    entities[0];

  return (
    <div className="flex items-center justify-between p-2 m-2 sm:m-3 border-[3px] border-[#2C194D] rounded-[28px] sm:rounded-[32px] bg-[#9D7FE3] relative z-30 shrink-0 min-w-0 shadow-[4px_4px_0px_#2C194D]">
      {/* Left Navigation Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => ui.setSidebarOpen((prev) => !prev)}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 lg:hidden shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all"
          title="Open Menu"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => store.setCurrentId(null)}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all text-base cursor-pointer"
          title="Return to Sanctuary Home Hub"
        >
          🏠
        </button>
        <div className="hidden md:flex">
          <Presence state={presence} />
        </div>
      </div>

      {/* Center: Clean Companion Identity Banner -> Shared-Element Morph to Sanctuary Quarters */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-1.5">
        <motion.button
          layoutId={resolveSharedLayoutId('chat-header-quarters', reducedMotion)}
          transition={{ layout: sharedTransition }}
          style={{ borderRadius: 16 }}
          onClick={() => ui.openModalWithOrigin('entityQuarters', 'chat-header-quarters')}
          className="flex items-center gap-2 px-3 py-1 sm:py-1.5 rounded-2xl bg-[#F5E1C8] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:bg-[#FAF0E4] active:translate-y-0.5 transition-colors max-w-[225px] sm:max-w-xs min-w-0 group cursor-pointer"
          title="View Companion Quarters & Room"
        >
          <motion.div
            layoutId={resolveSharedLayoutId('chat-header-quarters', reducedMotion, 'icon')}
            transition={{ layout: sharedTransition }}
            style={{
              borderRadius: 12,
              backgroundColor: companion?.themeColor || '#9D7FE3',
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-2 border-[#2C194D] flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden shadow-xs relative"
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
          </motion.div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-extrabold text-[#2C194D] text-xs sm:text-sm truncate leading-tight">
                {companion?.displayName || 'Companion'}
              </span>
              <span className="text-[10px] text-[#F198B7] shrink-0">✦</span>
            </div>
            {presence === 'responding' || presence === 'deep_thinking' ? (
              <span className="text-[10px] text-[#2C194D] font-extrabold truncate leading-none flex items-center gap-1">
                <span className="truncate">
                  {companion?.typingIndicator
                    ? companion.typingIndicator.charAt(0).toUpperCase() +
                      companion.typingIndicator.slice(1)
                    : 'Typing'}
                </span>
                <span className="inline-flex items-center space-x-0.5 shrink-0">
                  <motion.span
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="w-1 h-1 bg-[#2C194D] rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1 h-1 bg-[#2C194D] rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1 h-1 bg-[#2C194D] rounded-full"
                  />
                </span>
              </span>
            ) : presence === 'listening' ? (
              <span className="text-[10px] text-[#2C194D]/85 font-bold truncate leading-none">
                Listening to you...
              </span>
            ) : (
              <span className="text-[10px] text-[#2C194D]/75 font-semibold truncate leading-none">
                {companion?.roleTitle || 'Sanctuary Anchor'}
              </span>
            )}
          </div>
        </motion.button>
      </div>

      {/* Right Archives Dock & Account */}
      <div className="flex items-center gap-1.5 shrink-0">
        <SyncStatusBadge compact />
        {/* Desktop / Tablet Archive Quick-Triggers (Shared Element Sources) */}
        <div className="hidden md:flex items-center gap-1 bg-[#151234]/15 p-1 rounded-2xl border-[2px] border-[#2C194D]/40">
          {/* Gifts Archive */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-gifts', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('gifts', 'chat-header-gifts')}
            className="w-9 h-9 flex items-center justify-center bg-[#F198B7] hover:bg-[#f7e5cb] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Gifts Archive"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-gifts', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <Gift size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>

          {/* Memories Archive */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-memories', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('memories', 'chat-header-memories')}
            className="w-9 h-9 flex items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Memories Archive"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-memories', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <Bookmark size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>

          {/* Levin Jewel */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-jewel', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('jewel', 'chat-header-jewel')}
            className="w-9 h-9 flex items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="The Levin Jewel"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-jewel', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <Gem size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>

          {/* Whisper Board / Desires (xl+) */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-desires', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('desires', 'chat-header-desires')}
            className="hidden xl:flex w-9 h-9 items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Sanctuary Whisper Board"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-desires', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center text-sm"
            >
              💭
            </motion.span>
          </motion.button>

          {/* Sticker Chest (xl+) */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-stickers', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('stickerChest', 'chat-header-stickers')}
            className="hidden xl:flex w-9 h-9 items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Sanctuary Sticker Chest"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-stickers', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <Tag size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>

          {/* Dossier Profile (xl+) */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-profile', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('profile', 'chat-header-profile')}
            className="hidden xl:flex w-9 h-9 items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Your Sanctuary Dossier"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-profile', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <User size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>

          {/* Settings (lg+) */}
          <motion.button
            layoutId={resolveSharedLayoutId('chat-header-settings', reducedMotion)}
            transition={{ layout: sharedTransition }}
            style={{ borderRadius: 12 }}
            onClick={() => ui.openModalWithOrigin('settings', 'chat-header-settings')}
            className="hidden lg:flex w-9 h-9 items-center justify-center bg-[#F5E1C8] hover:bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl text-[#2C194D] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
            title="Sanctuary Settings"
          >
            <motion.span
              layoutId={resolveSharedLayoutId('chat-header-settings', reducedMotion, 'icon')}
              transition={{ layout: sharedTransition }}
              className="flex items-center justify-center"
            >
              <SettingsIcon size={16} strokeWidth={2.5} />
            </motion.span>
          </motion.button>
        </div>

        {/* Auth Button */}
        <motion.button
          layoutId={resolveSharedLayoutId('chat-header-auth', reducedMotion)}
          transition={{ layout: sharedTransition }}
          style={{ borderRadius: 16 }}
          onClick={() => ui.openModalWithOrigin('authModal', 'chat-header-auth')}
          className={`h-10 sm:h-11 px-2.5 sm:px-3 flex items-center justify-center border-[3px] border-[#2C194D] rounded-2xl shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-colors cursor-pointer ${
            store.user
              ? 'bg-[#F5E1C8] text-[#2C194D]'
              : 'bg-[#F198B7] text-[#2C194D] animate-pulse'
          }`}
          title={store.user ? `Signed in as ${store.user.email}` : 'Sign In with Google'}
        >
          <motion.span
            layoutId={resolveSharedLayoutId('chat-header-auth', reducedMotion, 'icon')}
            transition={{ layout: sharedTransition }}
            className="flex items-center justify-center"
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
          </motion.span>
          <span className="hidden 2xl:inline-block ml-1.5 text-xs font-extrabold truncate max-w-[90px]">
            {store.user ? store.user.displayName?.split(' ')[0] || 'Auth' : 'Sign In'}
          </span>
        </motion.button>

        {/* Overflow Menu (< xl) -> Shared-Element Origin for Compact/Mobile Screens */}
        <motion.button
          layoutId={resolveSharedLayoutId('chat-header-more', reducedMotion)}
          transition={{ layout: sharedTransition }}
          style={{ borderRadius: 16 }}
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-10 h-10 sm:w-11 sm:h-11 flex xl:hidden items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-colors cursor-pointer"
          title="Archives & Sanctuary Tools"
        >
          <motion.span
            layoutId={resolveSharedLayoutId('chat-header-more', reducedMotion, 'icon')}
            transition={{ layout: sharedTransition }}
            className="flex items-center justify-center"
          >
            <MoreVertical size={20} strokeWidth={2.5} />
          </motion.span>
        </motion.button>

        <button
          onClick={() => setShowDevPanel(!showDevPanel)}
          className="hidden xl:flex w-11 h-11 items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
          title="Developer Details & Export"
        >
          <Terminal size={18} strokeWidth={2.5} />
        </button>

        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-3 w-60 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-3 shadow-[6px_6px_0_#2C194D] z-50 text-sm flex flex-col gap-2 max-w-[calc(100vw-1.5rem)] max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('authModal', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">
                  {store.user ? 'Account / Auth' : 'Sign In with Google'}
                </span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('entityQuarters', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#f7e5cb] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0 text-base">
                  🏛️
                </div>
                <span className="flex-1 font-bold">Quarters</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('gifts', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Gift size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Gifts Archive</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('memories', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#B39DE5] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Bookmark size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Memories Archive</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('jewel', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#F5E1C8] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Gem size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">The Levin Jewel</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('desires', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0 text-base">
                  💭
                </div>
                <span className="flex-1 font-bold">Whisper Board</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('stickerChest', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#F198B7] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Tag size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Sticker Chest</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('profile', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#B39DE5] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <User size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Sanctuary Dossier</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  ui.openModalWithOrigin('settings', 'chat-header-more');
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#B39DE5] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <SettingsIcon size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Settings</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onExportMarkdown();
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#B39DE5] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Download size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Export Markdown</span>
              </button>
              <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowDevPanel(true);
                }}
                className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group cursor-pointer"
              >
                <div className="w-9 h-9 bg-[#B39DE5] border-[2.5px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                  <Terminal size={17} strokeWidth={2.5} />
                </div>
                <span className="flex-1 font-bold">Developer</span>
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
              <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45 hidden sm:block" />
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center border-b-[3px] border-[#2C194D] pb-2">
                  <span className="font-bold text-lg">Developer Details</span>
                  <button
                    onClick={() => setShowDevPanel(false)}
                    className="bg-[#F198B7] border-[3px] border-[#2C194D] rounded-lg p-1 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>

                <div className="space-y-2 text-xs font-bold">
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Companion</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]">
                      {companion?.displayName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Model ID</span>
                    <span
                      className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]"
                      title={activeModelId}
                    >
                      {activeModelId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Messages</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">
                      {conversation?.messages?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Temperature</span>
                    <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">
                      {settings.temperature.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#2C194D]/70">Streaming</span>
                    <span className="bg-[#F198B7] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">
                      Enabled
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowDevPanel(false);
                    onExportMarkdown();
                  }}
                  className="mt-1 w-full py-2 px-3 rounded-xl bg-[#B39DE5] hover:bg-[#F198B7] border-[2px] border-[#2C194D] text-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Export Session Markdown</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
