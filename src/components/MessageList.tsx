import React, { useRef, useEffect } from 'react';
import { Conversation, Message } from '../lib/types';
import { MessageBubble } from './MessageBubble';
import { resolveModelIdentity } from '../lib/modelSystem';
import { motion } from 'motion/react';
import { useStore } from '../context/AppContext';

export interface MessageListProps {
  conversation: Conversation;
  visibleMessages: Message[];
  isGenerating: boolean;
  onCopy: (text: string) => void;
  onResend: (content: string, originalIndex: number) => void;
  onFavorite: (content: string) => void;
  onImageClick: (url: string) => void;
}

export function MessageList({
  conversation,
  visibleMessages,
  isGenerating,
  onCopy,
  onResend,
  onFavorite,
  onImageClick,
}: MessageListProps) {
  const store = useStore();
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

  const modelsList = Array.isArray(store.availableModels) ? store.availableModels : [];
  const modelName = modelsList.find(m => m.name === store.settings.model)?.displayName || resolveModelIdentity(store.settings.model)?.displayName || store.settings.model?.split('/').pop() || 'Model';

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6 custom-scrollbar z-10 min-h-0 w-full min-w-0 max-w-full">
      {visibleMessages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center relative">
          <div className="absolute top-[20%] left-[20%] text-[#F198B7] opacity-60">✦</div>
          <div className="absolute top-[40%] right-[20%] text-[#B39DE5] opacity-60">✦</div>
          <div className="absolute bottom-[30%] left-[30%] text-[#F198B7] opacity-60 text-xs">❤</div>
          <div className="absolute top-[10%] right-[30%] text-[#B39DE5] opacity-60 text-xs">✦</div>
          
          <div className="relative mb-6">
            <svg width="150" height="150" viewBox="0 0 150 150" className="drop-shadow-[6px_6px_0_rgba(44,25,77,1)] hover:scale-105 transition-transform duration-500">
              <defs>
                <linearGradient id="cloudGrad" x1="10%" y1="90%" x2="90%" y2="10%">
                  <stop offset="0%" stopColor="#3B28CC" />
                  <stop offset="40%" stopColor="#8B5CF6" />
                  <stop offset="75%" stopColor="#FF9EBB" />
                  <stop offset="100%" stopColor="#FBCFE8" />
                </linearGradient>
              </defs>
              
              {/* Outer stroke group */}
              <g stroke="#2C194D" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" fill="#2C194D">
                <circle cx="75" cy="75" r="45" />
                <circle cx="113" cy="75" r="25" />
                <circle cx="102" cy="102" r="23" />
                <circle cx="75" cy="113" r="22" />
                <circle cx="48" cy="102" r="24" />
                <circle cx="37" cy="75" r="25" />
                <circle cx="48" cy="48" r="23" />
                <circle cx="75" cy="37" r="22" />
                <circle cx="102" cy="48" r="24" />
              </g>

              {/* Inner gradient fill group */}
              <g fill="url(#cloudGrad)">
                <circle cx="75" cy="75" r="45" />
                <circle cx="113" cy="75" r="25" />
                <circle cx="102" cy="102" r="23" />
                <circle cx="75" cy="113" r="22" />
                <circle cx="48" cy="102" r="24" />
                <circle cx="37" cy="75" r="25" />
                <circle cx="48" cy="48" r="23" />
                <circle cx="75" cy="37" r="22" />
                <circle cx="102" cy="48" r="24" />
              </g>

              {/* Face details */}
              <ellipse cx="46" cy="85" rx="7" ry="5" fill="#FF9EBB" opacity="0.9" />
              <ellipse cx="104" cy="85" rx="7" ry="5" fill="#FF9EBB" opacity="0.9" />
              
              <circle cx="58" cy="78" r="4.5" fill="#2C194D" />
              <circle cx="92" cy="78" r="4.5" fill="#2C194D" />
              
              <path d="M 68 81 Q 71.5 86 75 82 Q 78.5 86 82 81" fill="none" stroke="#2C194D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-[#9D7FE3] font-bold text-2xl tracking-tight">The sanctuary</h3>
          <h3 className="text-[#9D7FE3] font-bold text-2xl tracking-tight">is quiet.</h3>
        </div>
      )}
      
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
    </div>
  );
}
