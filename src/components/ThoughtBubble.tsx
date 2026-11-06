import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ThoughtBubbleProps {
  text: string;
  status: 'thinking' | 'complete' | 'error';
  initiallyOpen?: boolean;
  modelName?: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  typingIndicator?: string;
}

export function ThoughtBubble({
  text,
  status,
  modelName,
  avatarEmoji,
  avatarUrl,
  typingIndicator,
}: ThoughtBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isScrolledToBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
    setAutoScroll(isScrolledToBottom);
  };

  const hasText = text.trim().length > 0;

  // Never render an empty "Thought process" pill once thinking is finished if there are no inner thoughts
  if (status !== 'thinking' && !hasText) {
    return null;
  }

  const labelPrefix = modelName || 'Companion';
  const indicatorAction = hasText
    ? 'is thinking'
    : (typingIndicator || 'is typing');

  return (
    <div className="mb-3 flex flex-col items-start w-full min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => {
          if (hasText) setIsOpen(!isOpen);
        }}
        disabled={!hasText}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full border-[3px] border-[#2C194D] bg-[#F5E1C8] text-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 active:shadow-none hover:bg-[#F198B7] disabled:opacity-95 transition-all group max-w-full"
      >
        {status === 'thinking' && (avatarUrl || avatarEmoji) ? (
          <span className="w-5 h-5 rounded-full border-[2px] border-[#2C194D] bg-[#B39DE5] flex items-center justify-center text-[11px] shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={labelPrefix} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{avatarEmoji}</span>
            )}
          </span>
        ) : (
          <Brain size={14} className={`text-[#2C194D] shrink-0 ${status === 'thinking' ? 'animate-pulse' : ''}`} />
        )}

        <span className="text-xs font-extrabold tracking-wide text-[#2C194D] truncate transition-colors">
          {status === 'thinking'
            ? `${labelPrefix} ${indicatorAction}`
            : `${labelPrefix}'s Thought Process`}
        </span>

        {status === 'thinking' && (
          <span className="flex items-center space-x-1 ml-0.5 shrink-0">
            <motion.span
              animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.1, delay: 0 }}
              className="w-1.5 h-1.5 bg-[#2C194D] rounded-full"
            />
            <motion.span
              animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.1, delay: 0.2 }}
              className="w-1.5 h-1.5 bg-[#2C194D] rounded-full"
            />
            <motion.span
              animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.1, delay: 0.4 }}
              className="w-1.5 h-1.5 bg-[#2C194D] rounded-full"
            />
          </span>
        )}

        {hasText && (
          isOpen ? (
            <ChevronUp size={14} className="text-[#2C194D] ml-1 shrink-0" strokeWidth={3} />
          ) : (
            <ChevronDown size={14} className="text-[#2C194D] ml-1 shrink-0" strokeWidth={3} />
          )
        )}
      </button>

      {isOpen && hasText && (
        <div className="w-full overflow-hidden">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="mt-2 w-full max-h-[320px] overflow-y-auto p-4 rounded-3xl bg-[#B39DE5] border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D] text-xs font-bold text-[#2C194D] whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]"
          >
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
