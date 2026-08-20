import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target1 = `  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [settled, setSettled] = useState(false);
  const [favorited, setFavorited] = useState(false);`;

const replacement1 = `  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [settled, setSettled] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  
  const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];`;

code = code.replace(target1, replacement1);

const target2 = `            <button onClick={() => { 
                if (!favorited) {
                  onFavorite?.(publicText);
                  setFavorited(true);
                }
                triggerHaptic('light');
              }} className={\`p-1.5 bg-glass rounded-lg hover:bg-white/10 transition-colors \${favorited ? 'text-copper' : 'text-mauve hover:text-champagne'}\`} title={favorited ? 'Favorited' : 'Favorite'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );`;

const replacement2 = `            <div className="relative">
              {!isUser && (
                <button 
                  onClick={() => setShowReactions(!showReactions)} 
                  className="p-1.5 bg-glass rounded-lg hover:bg-white/10 text-mauve hover:text-champagne transition-colors" 
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
                    className="absolute bottom-full left-0 mb-2 flex items-center gap-1 p-2 bg-ink/90 backdrop-blur-xl border border-glass-border rounded-xl shadow-xl z-50"
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
              }} className={\`p-1.5 bg-glass rounded-lg hover:bg-white/10 transition-colors \${favorited ? 'text-copper' : 'text-mauve hover:text-champagne'}\`} title={favorited ? 'Favorited' : 'Favorite'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>
        )}
        
        {msg.reaction && (
          <div className={\`absolute \${isUser ? '-left-3' : '-right-3'} -bottom-3 bg-ink border border-glass-border rounded-full p-1.5 shadow-md text-sm z-10 animate-in zoom-in duration-300\`}>
            {msg.reaction}
          </div>
        )}
      </div>
    </motion.div>
  );`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/components/ChatArea.tsx', code);
