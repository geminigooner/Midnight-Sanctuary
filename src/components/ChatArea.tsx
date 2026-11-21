import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Message,
  VideoAttachmentMeta,
  getPublicMessageText,
  getThoughtMessageText,
  isInternalToolResponseTurn,
} from '../lib/types';
import { useChatStream } from '../hooks/useChatStream';
import { X, Menu, Settings as SettingsIcon, ShieldCheck, FolderHeart } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputDock } from './ChatInputDock';
import { SanctuaryHomeHub } from './SanctuaryHomeHub';
import { compressImage } from '../lib/imageUtils';
import { useStore, useUI } from '../context/AppContext';
import { getMotion, resolveSharedLayoutId } from '../lib/motion';

export { compressImage };

export function ChatArea() {
  const store = useStore();
  const ui = useUI();
  const reducedMotion = useReducedMotion();
  const sharedTransition = getMotion('shared', reducedMotion);
  const conversation = store.conversations.find(c => c.id === store.currentId);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<
    {
      mimeType: string;
      data: string;
      previewUrl?: string;
      caption?: string;
      fileName?: string;
      scope?: 'private' | 'shared';
      vaultItemId?: string;
    }[]
  >([]);
  const [videoAttachments, setVideoAttachments] = useState<VideoAttachmentMeta[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const activeModelId = conversation?.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';

  const {
    isGenerating,
    presence,
    setPresence,
    isScanningProfile,
    sendMessage,
    regenerateMessage,
    stopGeneration,
  } = useChatStream({
    conversation,
    settings: { ...store.settings, model: activeModelId },
    gifts: store.gifts,
    profile: store.profile,
    jewelMetrics: store.jewelMetrics,
    onUpdate: store.updateConversation,
    onAddMessage: store.addMessage,
    onUpdateMessage: store.updateMessage,
    onRemoveMessage: store.removeMessage,
    onUpdateJewel: store.updateJewelMetrics,
    onRecordEntityTurn: (store as any).recordEntityTurn,
    onAddGift: store.addGift,
    onAddMemory: store.addMemory,
    onAddEventLog: store.addEventLog,
    onAddGemmaNote: store.addGemmaNote,
    onUpdateEntityQuarters: (store as any).updateEntityQuarters,
    onRecordEntityThought: (store as any).recordEntityThought,
    onPlaceSticker: (store as any).placeSticker,
    onCraftSticker: (store as any).craftSticker,
    onAddRoomArtwork: (store as any).addRoomArtwork,
    onAddVaultItem: (store as any).addVaultItem,
    onAddVaultItemReaction: (store as any).addVaultItemReaction,
  });

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleFavorite = useCallback((content: string) => {
    const targetModelId = conversation?.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';
    store.addMemory(content, 'chat_starred', 'user', targetModelId);
  }, [conversation?.modelId, store.settings.model, store.addMemory]);

  const handleSend = useCallback((
    textToSend?: string,
    replaceIndex?: number,
    additionalMessages?: Message[],
    sendAttachments?: any[],
    sendVideoAttachments?: VideoAttachmentMeta[]
  ) => {
    const rawText = textToSend !== undefined ? textToSend : input;
    const currentAttachments = sendAttachments !== undefined ? sendAttachments : [...attachments];
    const currentVideoAttachments =
      sendVideoAttachments !== undefined ? sendVideoAttachments : [...videoAttachments];
    if (
      !rawText.trim() &&
      currentAttachments.length === 0 &&
      currentVideoAttachments.length === 0 &&
      (!additionalMessages || additionalMessages.length === 0)
    ) {
      return;
    }

    // If on home view without an active conversation, create one automatically
    let activeConvId = store.currentId;
    let targetConv = store.conversations.find(c => c.id === activeConvId);
    if (!activeConvId || !targetConv) {
      targetConv = store.createConversation(store.settings.model || 'models/gemini-3.1-pro-preview');
      activeConvId = targetConv.id;
    }

    const resolvedModel = targetConv.modelId || store.settings.model || 'models/gemini-3.1-pro-preview';
    if (!targetConv.modelId) {
      store.updateConversation(targetConv.id, { modelId: resolvedModel });
    }

    if (replaceIndex === undefined && textToSend === undefined) {
      setInput('');
      setAttachments([]);
      setVideoAttachments([]);
    }

    sendMessage(rawText, {
      attachments: currentAttachments,
      videoAttachments: currentVideoAttachments,
      replaceIndex,
      additionalMessages,
      targetConversationId: activeConvId,
      targetConversation: { ...targetConv, modelId: resolvedModel },
      targetSettings: { ...store.settings, model: resolvedModel },
    });
  }, [input, attachments, videoAttachments, sendMessage, store]);

  const handleExportMarkdown = useCallback(() => {
    if (!conversation) return;
    const exportModel = conversation.modelId || store.settings.model;
    const md = conversation.messages.map(m => {
      const role = m.role === 'user' ? '**You**' : `**${exportModel?.split('/').pop() || 'Model'}**`;
      const text = getPublicMessageText(m);
      return `${role}\n\n${text}\n\n---\n`;
    }).join('\n');
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title || 'sanctuary'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversation, store.settings.model]);

  // Update presence based on typing
  useEffect(() => {
    if (input.trim().length > 0 && !isGenerating) {
      setPresence('listening');
    } else if (!isGenerating) {
      setPresence('resting');
    }
  }, [input, isGenerating, setPresence]);

  // Listen for pendingPrompt triggers from Whisper Board (Desires), Roster, Quarters, Sparks
  useEffect(() => {
    if (!ui.pendingPrompt) return;
    const { text, modelId, conversationId, autoSend } = ui.pendingPrompt;
    
    // Clear pendingPrompt immediately to avoid duplicate triggers
    ui.setPendingPrompt(null);

    if (autoSend && text.trim()) {
      let targetConvId = conversationId || store.currentId;
      let targetConv = store.conversations.find(c => c.id === targetConvId);
      
      if (!targetConvId || !targetConv) {
        targetConv = store.createConversation(modelId);
        targetConvId = targetConv.id;
      }
      
      sendMessage(text, {
        targetConversationId: targetConvId,
        targetConversation: targetConv,
        targetSettings: modelId ? { ...store.settings, model: modelId } : undefined,
      });
    } else if (text) {
      setInput(text);
    }
  }, [ui.pendingPrompt, store, sendMessage, ui]);

  const visibleMessages = useMemo(() => {
    const all = conversation?.messages || [];
    const candidateMessages: Message[] = [];

    for (let idx = 0; idx < all.length; idx++) {
      const m = all[idx];
      if (!m || (m.role !== 'user' && m.role !== 'model')) continue;

      if (m.role === 'user') {
        if (isInternalToolResponseTurn(m)) continue;
        const hasUserText = getPublicMessageText(m).trim().length > 0;
        const hasAttachment = (m.parts || []).some((p: any) =>
          Boolean(p?.inlineData || p?.videoAttachment)
        );
        if (hasUserText || hasAttachment) {
          candidateMessages.push(m);
        }
        continue;
      }

      const isError = m.thoughtStatus === 'error';
      const isLast = idx === all.length - 1;
      const publicTxt = getPublicMessageText(m).trim();
      const thoughtTxt = getThoughtMessageText(m).trim();
      const hasMediaArtifacts =
        (m.generatedImages?.length ?? 0) > 0 ||
        (m.scribbles?.length ?? 0) > 0 ||
        (m.musicTracks?.length ?? 0) > 0 ||
        (m.searchResults?.length ?? 0) > 0 ||
        (m.parts || []).some((p: any) => Boolean(p?.inlineData || p?.videoAttachment));
      const isFunctionCallTurn = (m.parts || []).some((p: any) => Boolean(p?.functionCall));

      if (isFunctionCallTurn && !publicTxt && !hasMediaArtifacts && !isLast) {
        continue;
      }

      const hasVisibleContent =
        publicTxt.length > 0 || thoughtTxt.length > 0 || hasMediaArtifacts;

      if (!hasVisibleContent && !isError && !(isGenerating && isLast)) {
        continue;
      }

      candidateMessages.push(m);
    }

    // Coalesce any legacy standalone thought-only model bubble into the immediately following model reply bubble
    const merged: Message[] = [];
    for (let i = 0; i < candidateMessages.length; i++) {
      const current = candidateMessages[i];
      const next = candidateMessages[i + 1];

      if (current.role === 'model' && next && next.role === 'model') {
        const currentPublic = getPublicMessageText(current).trim();
        const currentThought = getThoughtMessageText(current).trim();
        const currentHasMedia =
          (current.generatedImages?.length ?? 0) > 0 ||
          (current.scribbles?.length ?? 0) > 0 ||
          (current.musicTracks?.length ?? 0) > 0 ||
          (current.searchResults?.length ?? 0) > 0 ||
          (current.parts || []).some((p: any) => Boolean(p?.inlineData));

        if (!currentPublic && !currentHasMedia && currentThought) {
          const nextThought = getThoughtMessageText(next).trim();
          const combinedThought = !nextThought
            ? currentThought
            : nextThought.includes(currentThought)
            ? nextThought
            : `${currentThought}\n\n${nextThought}`;
          candidateMessages[i + 1] = {
            ...next,
            thoughtText: combinedThought,
          };
          continue;
        }
      }

      merged.push(current);
    }

    return merged;
  }, [conversation?.messages, isGenerating]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1a153b] relative overflow-hidden min-w-0 max-w-full">
      {conversation ? (
        <ChatHeader
          conversation={conversation}
          presence={presence}
          visibleMessagesCount={visibleMessages.length}
          onExportMarkdown={handleExportMarkdown}
        />
      ) : (
        <div className="flex items-center justify-between p-2 m-2 sm:m-3 border-[3px] border-[#2d225c] rounded-2xl bg-[#f7e5cb] relative z-30 shrink-0 min-w-0 shadow-[0_4px_0_0_#2d225c]">
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 px-1 sm:px-2 py-0.5">
            <button 
              onClick={() => ui.setSidebarOpen(prev => !prev)} 
              className="w-10 h-10 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2d225c] rounded-xl text-[#2d225c] shrink-0 lg:hidden shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] active:translate-y-0.5 transition-all"
              title="Open Navigation"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="hidden lg:block w-10 shrink-0" />
            <div className="flex-1 flex items-center justify-center min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg">✨</span>
                <span className="font-extrabold text-[#2d225c] text-lg sm:text-xl tracking-tight font-serif truncate">Midnight Sanctuary</span>
                <span className="text-base sm:text-lg">✨</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                layoutId={resolveSharedLayoutId('home-topbar-settings', reducedMotion)}
                transition={{ layout: sharedTransition }}
                style={{ borderRadius: 12 }}
                onClick={() => ui.openModalWithOrigin('settings', 'home-topbar-settings')}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-[#B39DE5] hover:bg-[#F198B7] border-[2.5px] border-[#2d225c] rounded-xl text-[#2d225c] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer"
                title="Sanctuary Configuration"
              >
                <motion.span
                  layoutId={resolveSharedLayoutId('home-topbar-settings', reducedMotion, 'icon')}
                  transition={{ layout: sharedTransition }}
                  className="flex items-center justify-center"
                >
                  <SettingsIcon size={17} strokeWidth={2.5} />
                </motion.span>
              </motion.button>
              <motion.button
                layoutId={resolveSharedLayoutId('home-topbar-auth', reducedMotion)}
                transition={{ layout: sharedTransition }}
                style={{ borderRadius: 12 }}
                onClick={() => ui.openModalWithOrigin('authModal', 'home-topbar-auth')}
                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border-[2.5px] border-[#2d225c] rounded-xl text-[#2d225c] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] active:translate-y-0.5 transition-colors cursor-pointer ${
                  store.user ? 'bg-[#F5E1C8] hover:bg-[#B39DE5]' : 'bg-[#F198B7]'
                }`}
                title={store.user ? `Signed in as ${store.user.email}` : 'Sign In to Sanctuary'}
              >
                <motion.span
                  layoutId={resolveSharedLayoutId('home-topbar-auth', reducedMotion, 'icon')}
                  transition={{ layout: sharedTransition }}
                  className="flex items-center justify-center"
                >
                  {store.user?.photoURL ? (
                    <img
                      src={store.user.photoURL}
                      alt={store.user.displayName || 'User'}
                      className="w-5 h-5 rounded-full border border-[#2d225c] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ShieldCheck size={17} strokeWidth={2.5} />
                  )}
                </motion.span>
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {conversation ? (
        <>
          <MessageList
            conversation={conversation}
            visibleMessages={visibleMessages}
            isGenerating={isGenerating}
            onCopy={handleCopy}
            onResend={(content, origIndex, atts, vidAtts) =>
              handleSend(content, origIndex, undefined, atts, vidAtts)
            }
            onFavorite={handleFavorite}
            onImageClick={(url) => setSelectedImage(url)}
            onSelectPrompt={(prompt) => handleSend(prompt)}
          />

          <ChatInputDock
            conversation={conversation}
            visibleMessages={visibleMessages}
            isGenerating={isGenerating}
            input={input}
            setInput={setInput}
            attachments={attachments}
            setAttachments={setAttachments}
            videoAttachments={videoAttachments}
            setVideoAttachments={setVideoAttachments}
            onSend={handleSend}
            onStopGeneration={stopGeneration}
            onRegenerate={regenerateMessage}
          />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 custom-scrollbar z-10 min-h-0 w-full min-w-0 max-w-full flex items-start justify-center bg-[#1a153b]">
          <SanctuaryHomeHub onSelectPrompt={(prompt) => handleSend(prompt)} />
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#151234]/95 backdrop-blur-md cursor-pointer"
          >
            <button className="absolute top-6 right-6 p-2 text-[#2C194D] hover:text-white transition-colors bg-white/10 rounded-full">
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage}
              alt="Full size attachment"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
