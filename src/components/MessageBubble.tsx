import React, { useState, useRef, useEffect } from 'react';
import { Message, getPublicMessageText, getThoughtMessageText } from '../lib/types';
import { Copy, Edit3, X, Smile, Globe, Search, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { StreamingMarkdown } from './StreamingMarkdown';
import { ThoughtBubble } from './ThoughtBubble';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { getMotion } from '../lib/motion';
import { triggerHaptic } from '../lib/haptics';

export const MessageBubble = React.memo(function MessageBubble({ 
   msg, 
   isLast, 
   isGenerating, 
   onCopy, 
   onResend,
  onFavorite,
  onImageClick,
  onDelete,
  onReact,
  modelName
}: { 
   msg: Message;
  isLast: boolean;
  isGenerating: boolean;
  onCopy: (t: string) => void;
  onResend?: (content: string) => void;
  onFavorite?: (content: string) => void;
  onImageClick?: (url: string) => void;
  onDelete?: () => void;
  onReact?: (reaction: string) => void;
  modelName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [settled, setSettled] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showSources, setShowSources] = useState(false);
  
  const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
  
  useEffect(() => {
    if (isLast && !isGenerating) {
      setSettled(true);
      const timer = setTimeout(() => setSettled(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isLast, isGenerating]);

  const [startLongPress, setStartLongPress] = useState(false);
  const timerId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (startLongPress) {
      timerId.current = setTimeout(() => {
        onCopy(publicText);
        triggerHaptic('medium');
        setStartLongPress(false);
      }, 500);
    } else {
      if (timerId.current) clearTimeout(timerId.current);
    }
    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [startLongPress, msg, onCopy]);

  const bindLongPress = {
    onMouseDown: () => setStartLongPress(true),
    onMouseUp: () => setStartLongPress(false),
    onMouseLeave: () => setStartLongPress(false),
    onTouchStart: () => setStartLongPress(true),
    onTouchEnd: () => setStartLongPress(false),
  };

  const isUser = msg.role === 'user';
  
  const userClasses = "bg-[#B39DE5] border-[3px] border-[#2C194D] text-[#2C194D] font-bold shadow-[4px_4px_0_#2C194D]";
  const gemmaClasses = "bg-[#F5E1C8] border-[3px] border-[#2C194D] text-[#2C194D] font-bold shadow-[4px_4px_0_#2C194D]";
  
  const publicText = getPublicMessageText(msg);
  const thoughtText = getThoughtMessageText(msg);
  const isWaitingForToken = isGenerating && isLast && !isUser && !publicText && !thoughtText;

  const reducedMotion = useReducedMotion();
  const bubbleMotion = getMotion('standard', reducedMotion);
  const messageVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.95 },
    visible: { 
       opacity: 1, 
       y: 0, 
       scale: 1, 
       transition: { type: 'spring' as const, stiffness: 400, damping: 25, mass: 0.8 } 
     }
  };

  return (
    <motion.div 
      variants={reducedMotion ? {} : messageVariants}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group w-full`}
    >
      <div 
        {...bindLongPress}
        className={`${isUser ? 'max-w-[85%] lg:max-w-[70%]' : 'max-w-[85%] lg:max-w-[75%]'} p-3 sm:p-4 rounded-3xl relative transition-all duration-300 select-text min-w-0 ${isUser ? userClasses : gemmaClasses}`}
        style={{
          boxShadow: settled ? (isUser ? 'inset 0 1px 2px rgba(255,255,255,0.05), 0 0 15px rgba(196,118,83,0.1)' : '0 4px 20px rgba(244,232,211,0.03), 0 0 20px rgba(244,232,211,0.1)') : undefined
        }}
      >
        {editing ? (
          <div className="flex flex-col gap-2 w-full min-w-0">
            <textarea 
              value={editContent} 
              onChange={e => setEditContent(e.target.value)} 
              className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-base outline-none resize-none text-[#2C194D] font-bold min-w-0"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-1">
              <button onClick={() => setEditing(false)} className="text-sm text-[#2C194D] hover:text-[#2C194D] font-bold transition-colors p-2">Cancel</button>
              <button onClick={() => { setEditing(false); onResend?.(editContent); triggerHaptic('light'); }} className="text-sm text-[#F198B7] font-medium hover:text-[#2C194D] font-bold transition-colors p-2">Resend</button>
            </div>
          </div>
        ) : (
          <div className={`prose prose-p:leading-relaxed prose-pre:bg-[#151234] prose-pre:text-[#F5E1C8] prose-pre:border-[3px] prose-pre:border-[#2C194D] prose-pre:rounded-xl prose-pre:overflow-x-auto min-w-0 max-w-none break-words [overflow-wrap:anywhere] text-[#2C194D] prose-headings:text-[#2C194D] prose-strong:text-[#2C194D] prose-a:text-[#F198B7] prose-code:text-[#F198B7] ${publicText.includes('[Generation stopped: repetition loop detected.]') ? 'text-[#F198B7]' : ''}`}>
            {(!isUser && (isWaitingForToken || Boolean(thoughtText?.trim()) || msg.thoughtStatus === 'thinking')) && (
              <ThoughtBubble
                text={thoughtText || ''}
                status={msg.thoughtStatus ?? 'complete'}
                modelName={modelName}
              />
            )}
            
            {(publicText || (!isWaitingForToken && !thoughtText)) && (
              <div className="min-w-0 break-words">
                <StreamingMarkdown content={publicText} isGenerating={isGenerating && isLast} />
              </div>
            )}

            {msg.finishReason && (
              <div className="text-xs text-[#B39DE5]/50 mt-2 italic">
                [cut off: {msg.finishReason}]
              </div>
            )}
            
            {msg.backend === 'cloudflare' && (
              <div className="text-xs text-[#B39DE5]/50 mt-2 italic">
                via Cloudflare
              </div>
            )}

            {msg.searchResults && msg.searchResults.length > 0 && (
              <div className="mt-3 pt-2 border-t-[2px] border-[#2C194D]/20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSources(!showSources);
                    triggerHaptic('light');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2C194D]/10 hover:bg-[#2C194D]/20 text-[#2C194D] text-xs font-extrabold transition-all"
                >
                  <Globe size={13} className="text-[#2C194D]" />
                  <span>{msg.searchResults.reduce((acc, s) => acc + s.results.length, 0)} Web Source{msg.searchResults.reduce((acc, s) => acc + s.results.length, 0) === 1 ? '' : 's'} Consulted</span>
                  {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <AnimatePresence>
                  {showSources && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2 space-y-2"
                    >
                      {msg.searchResults.map((search, sIdx) => (
                        <div key={sIdx} className="bg-[#2C194D]/5 p-2 rounded-xl border border-[#2C194D]/15 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C194D]/80">
                            <Search size={11} />
                            <span>Query: <strong className="text-[#2C194D]">"{search.query}"</strong></span>
                          </div>
                          {search.results.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1.5 pt-1">
                              {search.results.map((res, rIdx) => (
                                <a
                                  key={rIdx}
                                  href={res.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block p-1.5 rounded-lg bg-[#f7e5cb] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:translate-x-0.5 transition-transform group/link"
                                >
                                  <div className="flex items-center justify-between text-xs font-black text-[#2C194D] truncate">
                                    <span className="truncate">{res.title}</span>
                                    <ExternalLink size={11} className="shrink-0 opacity-70 group-hover/link:opacity-100 ml-1" />
                                  </div>
                                  {res.snippet && (
                                    <p className="text-[11px] text-[#2C194D]/80 line-clamp-2 mt-0.5 leading-snug">
                                      {res.snippet}
                                    </p>
                                  )}
                                  {res.displayLink && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#2C194D]/60 mt-1 block">
                                      {res.displayLink}
                                    </span>
                                  )}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] italic text-[#2C194D]/60">No web results returned for this query.</p>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {msg.parts?.map((part, i) => part.inlineData ? (
                  <img 
                    key={i} 
                    src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                    className="mt-3 rounded-xl max-w-full h-auto max-h-[300px] border-[3px] border-[#2C194D] shadow-lg cursor-pointer hover:opacity-90 transition-opacity" 
                    alt="Attached" 
                    onClick={() => onImageClick?.(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)}
                  />
                ) : null)}
          </div>
        )}
        
        {!editing && (
          <div className={`mt-2 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button onClick={() => { onCopy(publicText); triggerHaptic('light'); }} className="p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:text-[#2C194D] font-bold text-[#2C194D] transition-colors" title="Copy"><Copy size={14} /></button>
            {isUser && (
              <>
                <button onClick={() => { setEditing(true); setEditContent(publicText); triggerHaptic('light'); }} className="p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:text-[#2C194D] font-bold text-[#2C194D] transition-colors" title="Edit"><Edit3 size={14} /></button>
                <button onClick={() => { onDelete?.(); triggerHaptic('heavy'); }} className="p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] hover:text-red-400 text-[#2C194D] transition-colors" title="Delete"><X size={14} /></button>
              </>
            )}
            <div className="relative">
              {!isUser && (
                <button 
                  onClick={() => setShowReactions(!showReactions)} 
                  className="p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] text-[#2C194D] hover:text-[#2C194D] font-bold transition-colors" 
                  title="React"
                >
                  <Smile size={14} />
                </button>
              )}
              <AnimatePresence>
                {showReactions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 p-2 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-2xl shadow-[4px_4px_0_#2C194D] z-50"
                  >
                    {REACTION_EMOJIS.map(emoji => (
                      <button 
                        key={emoji}
                        onClick={() => {
                          onReact?.(emoji);
                          setShowReactions(false);
                          triggerHaptic('medium');
                        }}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => { 
                if (!favorited) {
                  onFavorite?.(publicText);
                  setFavorited(true);
                }
                triggerHaptic('light');
              }} className={`p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] transition-colors ${favorited ? 'text-[#F198B7]' : 'text-[#2C194D] hover:text-[#2C194D] font-bold'}`} title={favorited ? 'Favorited' : 'Favorite'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>
        )}
        
        <AnimatePresence>
          {msg.reaction && (
            <motion.div 
              key={msg.reaction}
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0 }}
              whileHover={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.8 }}
              className={`absolute ${isUser ? '-left-3' : '-right-3'} -bottom-3 bg-[#151234] border-[3px] border-[#2C194D] rounded-full p-1.5 shadow-md text-sm z-10 cursor-pointer`}
            >
              {msg.reaction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}, (prev, next) => prev.msg === next.msg && prev.isLast === next.isLast && prev.isGenerating === next.isGenerating);
