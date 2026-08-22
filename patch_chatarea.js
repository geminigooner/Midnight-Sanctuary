import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// 1. Replace main background
code = code.replace(
  'className="flex-1 flex flex-col h-full bg-obsidian relative"',
  'className="flex-1 flex flex-col h-full bg-[#151234] relative"'
);

// 2. Remove radial gradient
code = code.replace(
  'className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-plum/10 via-obsidian/0 to-obsidian/0"',
  'className="hidden"'
);

// 3. Replace Header
const headerRegex = /\{\/\* Header \*\/\}.*?(?=\{\/\* Messages \*\/\})/s;
const newHeader = `{/* Header */}
      <div className="flex items-center justify-between p-2 m-2 sm:m-3 border-[3px] border-[#2C194D] rounded-[32px] bg-[#9D7FE3] relative z-30 shrink-0 min-w-0 shadow-[4px_4px_0px_#2C194D]">
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 px-1">
          <button onClick={onToggleSidebar} className="w-12 h-12 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 lg:hidden shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all"><Menu size={24} strokeWidth={2.5} /></button>
          <Presence state={presence} />
          
          <div className="flex-1 flex items-center justify-center min-w-0">
             <div className="flex flex-col items-center min-w-0 w-full max-w-[280px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#F5E1C8]">✨</span>
                  <span className="font-bold text-[#2C194D] text-lg sm:text-xl tracking-tight">Midnight Sanctuary</span>
                  <span className="text-[#F5E1C8]">✨</span>
                </div>
                <div className="bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-full px-4 py-1.5 w-full flex justify-between items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.05)] text-sm">
                   <span className="text-[#2C194D] font-bold truncate">
                     ✨ {(Array.isArray(availableModels) ? availableModels : [])?.find(m => m.name === settings.model)?.displayName || settings.model?.split('/').pop() || 'Unknown Model'}
                   </span>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
                <div className="flex justify-between w-full px-2 mt-1 text-[10px] sm:text-xs font-bold text-[#2C194D]/70 uppercase tracking-widest">
                   <span>Temp {settings.temperature.toFixed(1)}</span>
                   <span className="text-[#F198B7]">•</span>
                   <span>Msgs {conversation.messages.length} / {visibleMessages.length}</span>
                </div>
             </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 px-1 relative">
           <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="w-12 h-12 flex sm:hidden items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all"><MoreVertical size={24} strokeWidth={2.5} /></button>
           <button onClick={() => setShowDevPanel(!showDevPanel)} className="hidden sm:flex w-12 h-12 items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-2xl text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all" title="Developer Details"><Terminal size={20} strokeWidth={2.5} /></button>
           
           <AnimatePresence>
            {showMobileMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-3 w-56 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-3 shadow-[6px_6px_0_#2C194D] z-50 text-base flex flex-col gap-2 max-w-[calc(100vw-1.5rem)]"
              >
                <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45"></div>
                <button onClick={() => { setShowMobileMenu(false); setShowDevPanel(true); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Terminal size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Developer</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); onOpenGifts(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Gift size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Gifts</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); onOpenJewel(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  </div>
                  <span className="flex-1 font-bold">Jewel</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); exportMarkdown(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Download size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Export</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); onOpenMemories(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><Bookmark size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Memories</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); onOpenProfile(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><User size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Profile</span>
                </button>
                <div className="h-0.5 w-full bg-[#2C194D]/10 rounded-full" />
                <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="flex items-center gap-3 p-0 text-[#2C194D] hover:scale-[1.02] transition-transform w-full text-left group">
                  <div className="w-10 h-10 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl flex items-center justify-center shrink-0"><SettingsIcon size={18} strokeWidth={2.5} /></div>
                  <span className="flex-1 font-bold">Settings</span>
                </button>
              </motion.div>
            )}
           </AnimatePresence>
           
           <AnimatePresence>
            {showDevPanel && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-3 w-64 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-4 shadow-[6px_6px_0_#2C194D] z-50 text-sm max-w-[calc(100vw-1.5rem)] text-[#2C194D]"
              >
                <div className="absolute -top-3 right-5 w-4 h-4 bg-[#F5E1C8] border-t-[3px] border-l-[3px] border-[#2C194D] rotate-45 hidden sm:block"></div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b-[3px] border-[#2C194D] pb-2">
                    <span className="font-bold text-lg">Developer Details</span>
                    <button onClick={() => setShowDevPanel(false)} className="bg-[#F198B7] border-[3px] border-[#2C194D] rounded-lg p-1 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all"><X size={14} strokeWidth={3} /></button>
                  </div>
                  
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-[#2C194D]/70">Provider</span>
                      <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">Google</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#2C194D]/70">Model ID</span>
                      <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]" title={settings.model}>{settings.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#2C194D]/70">Endpoint</span>
                      <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D] truncate max-w-[120px]">/api/chat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#2C194D]/70">Temperature</span>
                      <span className="bg-[#B39DE5] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">{settings.temperature.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#2C194D]/70">Streaming</span>
                      <span className="bg-[#F198B7] px-2 py-0.5 rounded-full border-[2px] border-[#2C194D]">Enabled</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>
      </div>
`;
code = code.replace(headerRegex, newHeader);

// 4. Replace Empty State
const emptyStateRegex = /\{visibleMessages\.length === 0 && \(\s*<div className="h-full flex items-center justify-center opacity-50">\s*<p className="text-mauve tracking-widest uppercase text-sm">The sanctuary is quiet\.<\/p>\s*<\/div>\s*\)\}/;
const newEmptyState = `{visibleMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center relative">
             <div className="absolute top-[20%] left-[20%] text-[#F198B7] opacity-60">✦</div>
             <div className="absolute top-[40%] right-[20%] text-[#B39DE5] opacity-60">✦</div>
             <div className="absolute bottom-[30%] left-[30%] text-[#F198B7] opacity-60 text-xs">❤</div>
             <div className="absolute top-[10%] right-[30%] text-[#B39DE5] opacity-60 text-xs">✦</div>
             
             <div className="relative mb-6">
                <div className="absolute -top-4 -left-6 text-[#F5E1C8] text-2xl font-bold rotate-[-15deg]">\\</div>
                <div className="absolute -top-6 left-2 text-[#F5E1C8] text-2xl font-bold">|</div>
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="1.5" className="drop-shadow-[4px_4px_0_rgba(44,25,77,0.5)]">
                   <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#9D7FE3" />
                   <circle cx="8" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                   <circle cx="12" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                   <circle cx="16" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                </svg>
                <div className="absolute -bottom-2 -right-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#F198B7" stroke="#2C194D" strokeWidth="2" className="drop-shadow-[2px_2px_0_rgba(44,25,77,0.5)]">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
             </div>
             <h3 className="text-[#9D7FE3] font-bold text-2xl tracking-tight">The sanctuary</h3>
             <h3 className="text-[#9D7FE3] font-bold text-2xl tracking-tight">is quiet.</h3>
          </div>
        )}`;
code = code.replace(emptyStateRegex, newEmptyState);

// 5. Replace Composer
const composerRegex = /<div className=\{`p-3 sm:p-4 shrink-0 transition-all duration-300 \$\{isComposerFocused \? 'pb-8' : ''\}`\}>.*?<\/div>\s*<\/div>\s*\)\;/s;
const newComposer = `<div className={\`m-2 sm:m-3 p-3 bg-[#9D7FE3] border-[3px] border-[#2C194D] rounded-[32px] shadow-[4px_4px_0_#2C194D] transition-all duration-300 \$\{isComposerFocused ? 'pb-6' : ''\}\`}>
        <div className="bg-[#9D7FE3] rounded-3xl relative">
          <div className="bg-transparent rounded-2xl flex flex-col">
            {attachments.length > 0 && (
              <div className="flex gap-2 px-2 pt-2 mb-2 overflow-x-auto custom-scrollbar">
                {attachments.map((att, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={att.previewUrl} className="h-16 w-16 object-cover rounded-xl border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]" alt="attachment" />
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-[#F198B7] rounded-full p-1 border-[2px] border-[#2C194D] shadow-[1px_1px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all"
                    >
                      <X size={12} strokeWidth={3} className="text-[#2C194D]" />
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
              <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 flex items-center justify-center bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-[20px] text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all" title="Attach Image">
                <Paperclip size={24} strokeWidth={2.5} />
              </button>
              
              <button onClick={() => setShowLeaveGift(true)} className="w-14 h-14 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all" title="Leave a Gift">
                <Gift size={24} strokeWidth={2.5} />
              </button>
              
              <div className="flex-1 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-[24px] shadow-[inset_0_3px_0_rgba(0,0,0,0.05)] relative flex">
                <textarea 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setIsComposerFocused(true)}
                  onBlur={() => setIsComposerFocused(false)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Whisper to the void..."
                  className="flex-1 bg-transparent max-h-48 min-h-[56px] py-4 px-5 resize-none outline-none text-[#2C194D] placeholder-[#2C194D]/40 font-bold text-base w-full"
                  rows={input.split('\\n').length > 1 ? Math.min(input.split('\\n').length, 5) : 1}
                />
              </div>
              
              {isGenerating ? (
                <button onClick={stopGeneration} className="w-16 h-14 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all">
                  <StopCircle size={24} strokeWidth={2.5} />
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  {visibleMessages.length > 0 && visibleMessages[visibleMessages.length-1].role === 'model' && (
                     <button onClick={handleRegenerate} className="hidden sm:flex w-14 h-14 items-center justify-center bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-[20px] text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all" title="Regenerate Last">
                       <RefreshCw size={24} strokeWidth={2.5} />
                     </button>
                  )}
                  <button 
                    onClick={() => handleSend()} 
                    disabled={!input.trim() && attachments.length === 0}
                    className="w-16 h-14 flex items-center justify-center bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] text-[#2C194D] shrink-0 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] disabled:active:translate-y-0"
                  >
                    <Send size={24} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );`;
code = code.replace(composerRegex, newComposer);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea.tsx successfully.");
