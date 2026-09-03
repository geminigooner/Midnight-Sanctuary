import React, { useRef, useEffect } from 'react';
import { Conversation, Message, DEFAULT_SETTINGS } from '../lib/types';
import { MessageBubble } from './MessageBubble';
import { resolveModelIdentity } from '../lib/modelSystem';
import { motion } from 'motion/react';
import { useStore } from '../context/AppContext';
import { EmptyChatGreeting } from './EmptyChatGreeting';

export interface MessageListProps {
  conversation: Conversation;
  visibleMessages: Message[];
  isGenerating: boolean;
  onCopy: (text: string) => void;
  onResend: (content: string, originalIndex: number) => void;
  onFavorite: (content: string) => void;
  onImageClick: (url: string) => void;
  onSelectPrompt?: (promptText: string) => void;
}

export function MessageList({
  conversation,
  visibleMessages,
  isGenerating,
  onCopy,
  onResend,
  onFavorite,
  onImageClick,
  onSelectPrompt,
}: MessageListProps) {
  const store = useStore();
  const settings = store?.settings || DEFAULT_SETTINGS;
  const availableModels = store?.availableModels || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollTimeoutRef.current) {
      window.cancelAnimationFrame(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    });
  }, [conversation?.messages, isGenerating]);

  const modelsList = Array.isArray(availableModels) ? availableModels : [];
  const activeModel = settings?.model || DEFAULT_SETTINGS.model;
  const modelName = modelsList.find(m => m.name === activeModel)?.displayName || resolveModelIdentity(activeModel)?.displayName || activeModel?.split('/').pop() || 'Model';

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6 custom-scrollbar z-10 min-h-0 w-full min-w-0 max-w-full flex flex-col">
      {visibleMessages.length === 0 && (
        <EmptyChatGreeting 
          conversation={conversation}
          onSelectPrompt={onSelectPrompt || (() => {})} 
        />
      )}
      
      {visibleMessages.length > 0 && (
        <motion.div 
          className="flex flex-col gap-6 w-full"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { 
              transition: { staggerChildren: 0.05 }
            }
          }}
        >
          {visibleMessages.map((msg, i) => (
            <MessageBubble 
              key={msg.id}
              msg={msg}
              isLast={i === visibleMessages.length - 1}
              isGenerating={isGenerating}
              modelName={modelName}
              onCopy={onCopy}
              onResend={(content) => {
                const origIndex = conversation.messages.findIndex(m => m.id === msg.id);
                onResend(content, origIndex);
              }}
              onFavorite={onFavorite}
              onImageClick={onImageClick}
              onDelete={() => store.removeMessage(conversation.id, msg.id)}
              onReact={(reaction) => store.updateMessage(conversation.id, msg.id, { reaction })}
            />
          ))}
          <div ref={bottomRef} />
        </motion.div>
      )}
    </div>
  );
}
