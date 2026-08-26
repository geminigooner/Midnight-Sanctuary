import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ThoughtBubbleProps {
  text: string;
  status: 'thinking' | 'complete' | 'error';
  initiallyOpen?: boolean;
  modelName?: string;
}

export function ThoughtBubble({ text, status, modelName }: ThoughtBubbleProps) {
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
  const labelPrefix = modelName || 'Model';

  return (
    <div className="mb-4 flex flex-col items-start w-full min-w-0 max-w-full">
      <button
        onClick={() => {
          if (hasText) setIsOpen(!isOpen);
        }}
        disabled={!hasText}
        className="flex items-center gap-2 px-4 py-2 rounded-full border-[3px] border-[#2C194D] bg-[#F5E1C8] text-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 active:shadow-none hover:bg-[#F198B7] disabled:opacity-80 transition-all group"
      >
        <Brain size={14} className={`text-[#2C194D] ${status === 'thinking' ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-bold tracking-wide text-[#2C194D] transition-colors">
          {status === 'thinking' ? `${labelPrefix} is thinking...` : 'Thought process'}
        </span>
        {status === 'thinking' && (
          <span className="flex space-x-0.5 ml-1">
            <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1 h-1 bg-[#2C194D] rounded-full" />
            <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 h-1 bg-[#2C194D] rounded-full" />
            <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1 h-1 bg-[#2C194D] rounded-full" />
          </span>
        )}
        {hasText && (
          isOpen ? (
            <ChevronUp size={14} className="text-[#2C194D] ml-1" strokeWidth={3} />
          ) : (
            <ChevronDown size={14} className="text-[#2C194D] ml-1" strokeWidth={3} />
          )
        )}
      </button>

      {isOpen && (
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
