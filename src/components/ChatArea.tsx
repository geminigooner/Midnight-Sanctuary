import React, { useState, useEffect, useCallback } from 'react';
import { Message, getPublicMessageText } from '../lib/types';
import { useChatStream } from '../hooks/useChatStream';
import { X, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputDock } from './ChatInputDock';
import { SanctuaryHomeHub } from './SanctuaryHomeHub';
import { compressImage } from '../lib/imageUtils';
import { useStore, useUI } from '../context/AppContext';

export { compressImage };

export function ChatArea() {
  const store = useStore();
  const ui = useUI();
  const conversation = store.conversations.find(c => c.id === store.currentId);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{ mimeType: string; data: string; previewUrl?: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    settings: store.settings,
    gifts: store.gifts,
    profile: store.profile,
    jewelMetrics: store.jewelMetrics,
    onUpdate: store.updateConversation,
    onAddMessage: store.addMessage,
    onUpdateMessage: store.updateMessage,
    onRemoveMessage: store.removeMessage,
    onUpdateJewel: store.updateJewelMetrics,
    onAddGift: store.addGift,
    onAddMemory: store.addMemory,
    onAddEventLog: store.addEventLog,
    onAddGemmaNote: store.addGemmaNote,
    onUpdateEntityQuarters: (store as any).updateEntityQuarters,
    onRecordEntityThought: (store as any).recordEntityThought,
    onPlaceSticker: (store as any).placeSticker,
    onCraftSticker: (store as any).craftSticker,
    onAddRoomArtwork: (store as any).addRoomArtwork,
  });

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleFavorite = useCallback((content: string) => {
    const activeModelId = store.settings.model;
    store.addMemory(content, 'chat_starred', 'user', activeModelId);
  }, [store.settings.model, store.addMemory]);

  const handleSend = useCallback((textToSend?: string, replaceIndex?: number, additionalMessages?: Message[], sendAttachments?: any[]) => {
    const rawText = textToSend !== undefined ? textToSend : input;
    const currentAttachments = sendAttachments !== undefined ? sendAttachments : [...attachments];
    if (!rawText.trim() && currentAttachments.length === 0 && (!additionalMessages || additionalMessages.length === 0)) return;

    // If on home view without an active conversation, create one automatically
    let activeConvId = store.currentId;
    let targetConv = store.conversations.find(c => c.id === activeConvId);
    if (!activeConvId || !targetConv) {
      targetConv = store.createConversation();
      activeConvId = targetConv.id;
    }

    if (replaceIndex === undefined && textToSend === undefined) {
      setInput('');
    }

    if (replaceIndex === undefined && textToSend === undefined) {
      setAttachments([]);
    }

    sendMessage(rawText, {
      attachments: currentAttachments,
      replaceIndex,
      additionalMessages,
      targetConversationId: activeConvId,
      targetConversation: targetConv,
      targetSettings: targetConv.modelId ? { ...store.settings, model: targetConv.modelId } : undefined,
    });
  }, [input, attachments, sendMessage, store]);

  const handleExportMarkdown = useCallback(() => {
    if (!conversation) return;
    const md = conversation.messages.map(m => {
      const role = m.role === 'user' ? '**You**' : `**${store.settings.model?.split('/').pop() || 'Model'}**`;
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

  const visibleMessages = (conversation?.messages || []).filter((m: Message, idx: number, all: Message[]) => {
    if (m.role !== 'user' && m.role !== 'model') return false;
    if (m.role === 'model') {
      const isError = m.thoughtStatus === 'error';
      // Keep real content, error banners with retry capability, and active streaming bubbles
      const hasContent = getPublicMessageText(m).trim().length > 0
        || (m.thoughtText ?? '').trim().length > 0
        || (m.generatedImages?.length ?? 0) > 0
        || (m.scribbles?.length ?? 0) > 0
        || (m.musicTracks?.length ?? 0) > 0
        || (m.searchResults?.length ?? 0) > 0
        || (m.parts || []).some((p: any) => p.functionCall || p.inlineData);
      const isLast = idx === all.length - 1;
      if (!hasContent && !isError && !(isGenerating && isLast)) return false;
    }
    return true;
  });

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
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 px-2 py-1">
            <button 
              onClick={() => ui.setSidebarOpen(prev => !prev)} 
              className="w-10 h-10 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2d225c] rounded-xl text-[#2d225c] shrink-0 lg:hidden shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] active:translate-y-0.5 transition-all"
              title="Open Navigation"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="flex-1 flex items-center justify-center min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg">✨</span>
                <span className="font-extrabold text-[#2d225c] text-lg sm:text-xl tracking-tight font-serif">Midnight Sanctuary</span>
                <span className="text-base sm:text-lg">✨</span>
              </div>
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
            onResend={(content, origIndex, atts) => handleSend(content, origIndex, undefined, atts)}
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
