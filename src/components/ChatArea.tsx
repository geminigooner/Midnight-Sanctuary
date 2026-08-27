import React, { useState, useEffect, useCallback } from 'react';
import { Message, getPublicMessageText } from '../lib/types';
import { useChatStream } from '../hooks/useChatStream';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputDock } from './ChatInputDock';
import { compressImage } from '../lib/imageUtils';
import { useStore } from '../context/AppContext';

export { compressImage };

export function ChatArea() {
  const store = useStore();
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
  }, [input, attachments, sendMessage]);

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

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#151234] text-[#B39DE5] font-bold">
        Select or start a new sanctuary.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#151234] relative overflow-hidden min-w-0 max-w-full">
      <ChatHeader
        conversation={conversation}
        presence={presence}
        visibleMessagesCount={visibleMessages.length}
        onExportMarkdown={handleExportMarkdown}
      />

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
