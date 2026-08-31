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
    onUpdateJewel: store.updateJewelMetrics,
    onAddGift: store.addGift,
    onAddMemory: store.addMemory,
    onAddEventLog: store.addEventLog,
    onAddGemmaNote: store.addGemmaNote,
    onUpdateEntityQuarters: (store as any).updateEntityQuarters,
    onRecordEntityThought: (store as any).recordEntityThought,
    onPlaceSticker: (store as any).placeSticker,
    onAddRoomArtwork: (store as any).addRoomArtwork,
  });

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleFavorite = useCallback((content: string) => {
    const activeModelId = store.settings.model;
    store.addMemory(content, 'chat_starred', 'user', activeModelId);
  }, [store.settings.model, store.addMemory]);

  const handleSend = useCallback((textToSend?: string, replaceIndex?: number, additionalMessages?: Message[]) => {
    const rawText = textToSend !== undefined ? textToSend : input;
    if (!rawText.trim() && attachments.length === 0 && (!additionalMessages || additionalMessages.length === 0)) return;

    // If on home view without an active conversation, create one automatically
    let activeConvId = store.currentId;
    if (!activeConvId || !store.conversations.some(c => c.id === activeConvId)) {
      const newConv = store.createConversation();
      activeConvId = newConv.id;
    }

    if (replaceIndex === undefined && textToSend === undefined) {
      setInput('');
    }

    const currentAttachments = [...attachments];
    if (replaceIndex === undefined && textToSend === undefined) {
      setAttachments([]);
    }

    sendMessage(rawText, {
      attachments: currentAttachments,
      replaceIndex,
      additionalMessages
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

  const visibleMessages = (conversation?.messages || []).filter(
    (m: Message) => m.role === 'user' || m.role === 'model'
  );

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

      {conversation && visibleMessages.length > 0 ? (
        <>
          <MessageList
            conversation={conversation}
            visibleMessages={visibleMessages}
            isGenerating={isGenerating}
            onCopy={handleCopy}
            onResend={(content, origIndex) => handleSend(content, origIndex)}
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
