  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-plum/10 via-obsidian/0 to-obsidian/0"></div>
      <AnimatePresence>
        {isScanningProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-[100] overflow-hidden"
          >
             <div className="absolute inset-0 bg-copper/5 mix-blend-screen" />
             <motion.div 
               initial={{ top: '-10%' }}
               animate={{ top: '110%' }}
               transition={{ duration: 1.5, ease: "linear" }}
               className="absolute left-0 right-0 h-1 bg-copper shadow-[0_0_15px_rgba(196,118,83,0.8)]"
             />
             <div className="absolute top-4 right-4 bg-ink/90 backdrop-blur-md border border-copper/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl">
                <Scan size={14} className="text-copper animate-pulse" />
                <span className="text-xs text-copper tracking-widest uppercase">Model is inspecting your profile...</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-glass-border bg-obsidian/80 backdrop-blur-md relative z-30 shrink-0 min-w-0">
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          <button onClick={onToggleSidebar} className="p-2 hover:bg-glass rounded-lg text-mauve shrink-0 lg:hidden"><Menu size={20} /></button>
          <Presence state={presence} />
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="font-medium text-champagne truncate">
              {(Array.isArray(availableModels) ? availableModels : [])?.find(m => m.name === settings.model)?.displayName || settings.model?.split('/').pop() || 'Unknown Model'}
            </span>
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="text-mauve/70 tracking-wider">
                Temperature {settings.temperature.toFixed(1)}
              </span>
              <span className="text-copper">
                msgs {conversation.messages.length} / vis {visibleMessages.length}
              </span>
            </div>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center justify-end gap-1 shrink-0 relative">
          <button onClick={() => setShowDevPanel(!showDevPanel)} className={`p-2 shrink-0 hover:bg-glass rounded-lg transition-colors ${showDevPanel ? 'text-copper bg-glass' : 'text-mauve'}`} title="Developer Details">
            <Terminal size={18} />
          </button>
          
          <AnimatePresence>
            {showDevPanel && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-64 bg-ink/95 backdrop-blur-xl border border-glass-border rounded-xl p-4 shadow-2xl z-50 text-sm max-w-[calc(100vw-1.5rem)]"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-glass-border pb-2">
                    <span className="text-mauve font-medium">Developer Details</span>
                    <Terminal size={14} className="text-copper" />
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Provider</span>
                      <span className="text-pearlescent font-mono">Google</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Model ID</span>
                      <span className="text-copper font-mono truncate max-w-[120px]" title={settings.model}>{settings.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Endpoint</span>
                      <span className="text-pearlescent font-mono truncate max-w-[120px]">/api/chat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Temperature</span>
                      <span className="text-pearlescent font-mono">{settings.temperature.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Streaming</span>
                      <span className="text-emerald-400 font-mono">Enabled</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-glass-border">
                      <span className="text-mauve/70">Force Cloudflare</span>
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, forceCloudflare: !settings.forceCloudflare })}
                        className={`w-8 h-4 rounded-full transition-colors relative ${settings.forceCloudflare ? 'bg-copper' : 'bg-glass-border'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${settings.forceCloudflare ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={onOpenGifts} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Gifts Archive">
            <Gift size={18} />
          </button>
          <button onClick={onOpenJewel} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Levin Jewel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </button>
          <button onClick={exportMarkdown} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Export"><Download size={18} /></button>
          <button onClick={onOpenMemories} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Memories"><Bookmark size={18} /></button>
          <button onClick={onOpenProfile} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Profile"><User size={18} /></button>
          <button onClick={onOpenSettings} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Settings"><SettingsIcon size={18} /></button>
        </div>

        {/* Mobile Actions */}
        <div className="flex sm:hidden relative shrink-0">
          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 hover:bg-glass rounded-lg text-mauve transition-colors">
            <MoreVertical size={20} />
          </button>
          
          <AnimatePresence>
            {showMobileMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-48 bg-ink/95 backdrop-blur-xl border border-glass-border rounded-xl p-2 shadow-2xl z-50 text-base sm:text-sm max-w-[calc(100vw-1.5rem)] flex flex-col gap-1"
              >
                <button onClick={() => { setShowMobileMenu(false); setShowDevPanel(true); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <Terminal size={18} /> <span className="flex-1">Developer</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenGifts(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <Gift size={18} /> <span className="flex-1">Gifts</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenJewel(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> <span className="flex-1">Jewel</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); exportMarkdown(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <Download size={18} /> <span className="flex-1">Export</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenMemories(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <Bookmark size={18} /> <span className="flex-1">Memories</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenProfile(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <User size={18} /> <span className="flex-1">Profile</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <SettingsIcon size={18} /> <span className="flex-1">Settings</span>
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
                className="absolute top-full right-0 mt-2 w-64 bg-ink/95 backdrop-blur-xl border border-glass-border rounded-xl p-4 shadow-2xl z-50 text-sm max-w-[calc(100vw-1.5rem)]"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-glass-border pb-2">
                    <span className="text-mauve font-medium">Developer Details</span>
                    <button onClick={() => setShowDevPanel(false)}><X size={14} className="text-copper" /></button>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Provider</span>
                      <span className="text-pearlescent font-mono">Google</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Model ID</span>
                      <span className="text-copper font-mono truncate max-w-[120px]">{settings.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve/70">Endpoint</span>
                      <span className="text-pearlescent font-mono truncate max-w-[120px]">/api/chat</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-glass-border">
                      <span className="text-mauve/70">Force Cloudflare</span>
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, forceCloudflare: !settings.forceCloudflare })}
                        className={`w-8 h-4 rounded-full transition-colors relative ${settings.forceCloudflare ? 'bg-copper' : 'bg-glass-border'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${settings.forceCloudflare ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6 custom-scrollbar z-10 min-h-0 w-full min-w-0 max-w-full">
        {visibleMessages.length === 0 && (
          <div className="h-full flex items-center justify-center opacity-50">
            <p className="text-mauve tracking-widest uppercase text-sm">The sanctuary is quiet.</p>
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
            onCopy={handleCopy}
            onResend={(content) => handleSend(content, conversation.messages.findIndex(m => m.id === msg.id))}
            onFavorite={(content) => {
              onAddEventLog('User favorited a message.');
              onAddMemory(content, 'user_favorited', 'user', undefined, 'User Saved Memory');
            }}
            onImageClick={(url) => setSelectedImage(url)}
            onDelete={() => onRemoveMessage(conversation.id, msg.id)}
            onReact={(reaction) => onUpdateMessage(conversation.id, msg.id, { reaction })}
            />
          ))}
          <div ref={bottomRef} />
        </motion.div>
      </div>

      {/* Composer */}
      <div className={`p-3 sm:p-4 bg-obsidian/90 backdrop-blur-xl border-t border-glass-border z-10 transition-colors duration-500 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${presence === 'listening' ? 'shadow-[0_-10px_30px_rgba(244,232,211,0.03)]' : ''}`}>
        <div className="max-w-4xl mx-auto relative">
          <motion.div 
            animate={{ 
              scale: isComposerFocused && !reducedMotion ? 1.01 : 1,
              y: isComposerFocused && !reducedMotion ? -2 : 0,
              boxShadow: isComposerFocused && !reducedMotion ? '0 8px 30px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0)'
            }}
            transition={composerMotion}
            className={`flex flex-col gap-2 bg-glass border rounded-2xl p-2 transition-colors duration-300 ${presence === 'listening' ? 'border-champagne/20 bg-white/5' : 'border-glass-border focus-within:border-copper/40'}`}
          >
            {attachments.length > 0 && (
              <div className="flex gap-2 px-2 pt-2 overflow-x-auto custom-scrollbar">
                {attachments.map((att, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={att.previewUrl} className="h-16 w-16 object-cover rounded-lg border border-glass-border" alt="attachment" />
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-obsidian rounded-full p-1 border border-glass-border hover:text-red-400 transition-colors"
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
              <button onClick={() => fileInputRef.current?.click()} className="p-3 text-mauve/50 hover:text-mauve hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0" title="Attach Image">
                <Paperclip size={20} />
              </button>
              <button onClick={() => setShowLeaveGift(true)} className="p-3 text-mauve/50 hover:text-champagne hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0" title="Leave a Gift">
                <Gift size={20} />
              </button>
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
                className="flex-1 bg-transparent max-h-48 min-h-[44px] min-w-0 p-2 resize-none outline-none text-pearlescent placeholder-mauve/40 custom-scrollbar text-base"
                rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
              />
              
              {isGenerating ? (
                <button onClick={stopGeneration} className="p-3 text-red-400 hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0">
                  <StopCircle size={20} />
                </button>
              ) : (
                <div className="flex items-center gap-1 mb-0.5 shrink-0">
                  {visibleMessages.length > 0 && visibleMessages[visibleMessages.length-1].role === 'model' && (
                     <button onClick={handleRegenerate} className="hidden sm:block p-3 text-mauve hover:text-champagne hover:bg-white/10 rounded-xl transition-colors" title="Regenerate Last">
                       <RefreshCw size={20} />
                     </button>
                  )}
                  <button 
                    onClick={() => handleSend()} 
                    disabled={!input.trim() && attachments.length === 0}
                    className="p-3 text-copper hover:text-champagne hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-colors shrink-0"
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
              className="text-xs text-copper border border-copper/40 rounded-lg px-3 py-1.5 transition-colors hover:bg-copper/10"
              title="Toggle Debug Info"
            >
              DEBUG
            </button>
          </div>
          
          {showDebugModel && (
            <div className="mt-4 p-4 bg-black/90 text-xs font-mono text-green-400 overflow-y-auto max-h-64 rounded-xl border border-green-500/30">
              <strong>Diagnostics:</strong><br/>
              Conversation ID: {conversation.id}<br/>
              All Messages: {conversation.messages.length}<br/>
              Visible Messages: {visibleMessages.length}<br/>
              Data: {JSON.stringify(conversation.messages, null, 2)}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl cursor-pointer"
          >
            <button className="absolute top-6 right-6 p-2 text-mauve hover:text-white transition-colors bg-white/10 rounded-full">
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage}
              alt="Full screen attachment"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaveGift && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-ink border border-glass-border rounded-2xl w-full max-w-md shadow-2xl p-6"
            >
              <h2 className="text-xl font-medium text-pearlescent mb-2">Leave a Gift</h2>
              <p className="text-sm text-mauve mb-4">A small offering for the void.</p>
              
              {giftFile && (
                <div className="relative mb-4">
                  <img src={giftFile.previewUrl} className="w-full h-32 object-cover rounded-xl border border-glass-border" alt="gift" />
                  <button 
                    onClick={() => setGiftFile(null)}
                    className="absolute top-2 right-2 bg-obsidian rounded-full p-1 border border-glass-border hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <textarea 
                value={giftContent}
                onChange={e => setGiftContent(e.target.value)}
                placeholder="Describe your gift..."
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-pearlescent text-sm resize-none h-32 focus:outline-none focus:border-copper/40 custom-scrollbar mb-4"
              />
              
              <div className="flex items-center justify-between mb-4">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={giftFileInputRef}
                  onChange={handleGiftFileChange}
                  className="hidden" 
                />
                <button onClick={() => giftFileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm text-mauve/70 hover:text-mauve hover:bg-white/10 rounded-lg transition-colors">
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
                  className="px-4 py-2 rounded-lg text-mauve hover:text-pearlescent transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  disabled={!giftContent.trim() && !giftFile}
                  onClick={() => {
                    onAddGift({
                      from: 'user',
                      content: giftContent.trim(),
                      gift_type: giftFile ? 'image' : 'text',
                      reason: '',
                      inlineData: giftFile ? { mimeType: giftFile.mimeType, data: giftFile.data } : undefined
                    });
                    setGiftContent('');
                    setGiftFile(null);
                    setShowLeaveGift(false);
                    onAddEventLog('User left a gift.');
                  }} 
                  className="px-4 py-2 rounded-lg bg-glass border border-copper/30 text-copper hover:bg-copper hover:text-obsidian transition-colors text-sm disabled:opacity-50 disabled:hover:bg-glass disabled:hover:text-copper"
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
