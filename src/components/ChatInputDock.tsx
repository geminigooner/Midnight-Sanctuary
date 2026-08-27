import React, { useState, useRef } from 'react';
import { Conversation, Message } from '../lib/types';
import { Send, StopCircle, RefreshCw, Paperclip, Gift, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageUtils';
import { useStore } from '../context/AppContext';

export interface ChatInputDockProps {
  conversation: Conversation;
  visibleMessages: Message[];
  isGenerating: boolean;
  input: string;
  setInput: (value: string) => void;
  attachments: { mimeType: string; data: string; previewUrl?: string }[];
  setAttachments: React.Dispatch<React.SetStateAction<{ mimeType: string; data: string; previewUrl?: string }[]>>;
  onSend: (text?: string, replaceIndex?: number, additionalMessages?: Message[]) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
}

export function ChatInputDock({
  conversation,
  visibleMessages,
  isGenerating,
  input,
  setInput,
  attachments,
  setAttachments,
  onSend,
  onStopGeneration,
  onRegenerate,
}: ChatInputDockProps) {
  const store = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const giftFileInputRef = useRef<HTMLInputElement>(null);
  const [showLeaveGift, setShowLeaveGift] = useState(false);
  const [giftContent, setGiftContent] = useState('');
  const [giftFile, setGiftFile] = useState<{ mimeType: string; data: string; previewUrl?: string } | null>(null);
  const [showDebugModel, setShowDebugModel] = useState(false);

  const handleGiftFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only images are supported currently.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setGiftFile(compressed);
    } catch (err) {
      console.error("Failed to compress image:", err);
    }
    
    if (giftFileInputRef.current) giftFileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only images are supported currently.');
      return;
    }

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
      
      const MAX_DIMENSION = 1536;
      let { width, height } = img;
      
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get 2d context");
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const targetMimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = 0.8;
      
      const dataUrl = canvas.toDataURL(targetMimeType, quality);
      const base64Data = dataUrl.split(',')[1];
      
      setAttachments(prev => [...prev, {
        mimeType: targetMimeType,
        data: base64Data,
        previewUrl: dataUrl
      }]);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Error compressing image:", err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        setAttachments(prev => [...prev, {
          mimeType: file.type,
          data: base64Data,
          previewUrl: result
        }]);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-3 sm:p-4 bg-[#151234] border-t-[3px] border-[#2C194D] z-10 transition-colors duration-500 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto relative">
        <motion.div 
          className="flex flex-col gap-2 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-2 transition-all duration-300 focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
        >
          {attachments.length > 0 && (
            <div className="flex gap-2 px-2 pt-2 overflow-x-auto custom-scrollbar">
              {attachments.map((att, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={att.previewUrl} className="h-16 w-16 object-cover rounded-lg border-[3px] border-[#2C194D]" alt="attachment" />
                  <button 
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-[#151234] rounded-full p-1 border-[3px] border-[#2C194D] hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-3 text-[#2C194D]/50 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D]" 
              title="Attach Image"
            >
              <Paperclip size={20} />
            </button>
            <button 
              onClick={() => setShowLeaveGift(true)} 
              className="p-3 text-[#2C194D]/50 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D]" 
              title="Leave a Gift"
            >
              <Gift size={20} />
            </button>
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Whisper to the void..."
              className="flex-1 bg-transparent max-h-48 min-h-[44px] min-w-0 px-3 py-2 resize-none outline-none text-[#2C194D] font-bold placeholder-[#2C194D]/40 custom-scrollbar text-base"
              rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
            />
            
            {isGenerating ? (
              <button 
                onClick={onStopGeneration} 
                className="p-3 text-red-500 hover:bg-red-500/20 border-[2px] border-transparent hover:border-red-500 rounded-xl transition-colors mb-0.5 shrink-0 font-bold"
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                {visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1].role === 'model' && (
                  <button 
                    onClick={onRegenerate} 
                    className="hidden sm:block p-3 text-[#2C194D]/80 hover:text-[#2C194D] hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl transition-colors font-bold" 
                    title="Regenerate Last"
                  >
                    <RefreshCw size={20} />
                  </button>
                )}
                <button 
                  onClick={() => onSend()} 
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-3 text-[#2C194D] hover:bg-[#B39DE5] border-[2px] border-transparent hover:border-[#2C194D] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent rounded-xl transition-colors shrink-0 font-bold"
                >
                  <Send size={20} />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <div className="flex justify-center mt-2">
          <button 
            onClick={() => setShowDebugModel(!showDebugModel)} 
            className="text-xs font-bold text-[#2C194D] bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl px-4 py-2 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all"
            title="Toggle Debug Info"
          >
            DEBUG
          </button>
        </div>
        
        {showDebugModel && (
          <div className="mt-4 p-4 bg-[#151234] text-xs font-mono text-green-400 overflow-y-auto max-h-64 rounded-xl border border-green-500/30">
            <strong>Diagnostics:</strong><br/>
            Conversation ID: {conversation.id}<br/>
            All Messages: {conversation.messages.length}<br/>
            Visible Messages: {visibleMessages.length}<br/>
            Data: {JSON.stringify(conversation.messages, null, 2)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLeaveGift && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-md p-6"
            >
              <h2 className="text-2xl font-bold text-[#F5E1C8] mb-1">Leave a Gift</h2>
              <p className="text-sm font-bold text-[#B39DE5] mb-4">A small offering for the void.</p>
              
              {giftFile && (
                <div className="relative mb-4">
                  <img src={giftFile.previewUrl} className="w-full h-32 object-cover rounded-2xl border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D]" alt="gift" />
                  <button 
                    onClick={() => setGiftFile(null)}
                    className="absolute top-2 right-2 bg-[#F198B7] text-[#2C194D] rounded-full p-1 border-[3px] border-[#2C194D] hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <textarea 
                value={giftContent}
                onChange={e => setGiftContent(e.target.value)}
                placeholder="Describe your gift..."
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 text-[#2C194D] font-bold text-sm resize-none h-32 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] custom-scrollbar mb-4 placeholder-[#2C194D]/40 transition-all"
              />
              
              <div className="flex items-center justify-between mb-4">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={giftFileInputRef}
                  onChange={handleGiftFileChange}
                  className="hidden" 
                />
                <button 
                  onClick={() => giftFileInputRef.current?.click()} 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#2C194D] bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 hover:bg-[#F198B7] transition-all"
                >
                  <Paperclip size={16} />
                  Attach Image
                </button>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setShowLeaveGift(false);
                    setGiftContent('');
                    setGiftFile(null);
                  }} 
                  className="px-4 py-2 rounded-xl text-[#F198B7] border-[3px] border-[#2C194D] bg-[#151234] hover:bg-[#F198B7] hover:text-[#2C194D] transition-all text-sm font-bold"
                >
                  Cancel
                </button>
                <button 
                  disabled={!giftContent.trim() && !giftFile}
                  onClick={() => {
                    store.addGift({
                      from: 'user',
                      targetModelId: store.settings.model,
                      modelId: store.settings.model,
                      content: giftContent.trim(),
                      gift_type: giftFile ? 'image' : 'text',
                      reason: '',
                      inlineData: giftFile ? { mimeType: giftFile.mimeType, data: giftFile.data } : undefined
                    });
                    setGiftContent('');
                    setGiftFile(null);
                    setShowLeaveGift(false);
                    store.addEventLog('User left a gift.');
                  }} 
                  className="px-4 py-2 rounded-lg bg-[#F5E1C8] border border-[#2C194D] text-[#F198B7] hover:bg-[#F198B7] hover:text-[#2C194D] transition-colors text-sm disabled:opacity-50 disabled:hover:bg-[#F5E1C8] disabled:hover:text-[#F198B7]"
                >
                  Leave Gift
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
