import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

const target = `interface MemoriesArchiveProps {
  memories: Memory[];
  onClose: () => void;
  onRemoveMemory?: (id: string) => void;
}

export function MemoriesArchive({ memories, onClose, onRemoveMemory }: MemoriesArchiveProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);`;

const replacement = `interface MemoriesArchiveProps {
  memories: Memory[];
  onClose: () => void;
  onRemoveMemory?: (id: string) => void;
  currentModel?: string;
}

export function MemoriesArchive({ memories, onClose, onRemoveMemory, currentModel }: MemoriesArchiveProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'model' | 'user'>('model');`;

code = code.replace(target, replacement);

const target2 = `        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {(!memories || memories.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-mauve opacity-50 space-y-4 min-h-[40vh]">
              <Bookmark size={48} className="opacity-20" />
              <p className="tracking-widest uppercase text-sm">No memories recorded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memories.map(memory => (`;

const replacement2 = `        <div className="flex border-b border-glass-border">
          <button
            onClick={() => setActiveTab('model')}
            className={\`flex-1 p-4 text-sm font-medium tracking-wide transition-colors \${activeTab === 'model' ? 'text-copper border-b-2 border-copper bg-white/5' : 'text-mauve hover:text-pearlescent'}\`}
          >
            Model Memories
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={\`flex-1 p-4 text-sm font-medium tracking-wide transition-colors \${activeTab === 'user' ? 'text-copper border-b-2 border-copper bg-white/5' : 'text-mauve hover:text-pearlescent'}\`}
          >
            User Saved Memories
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {(() => {
            const displayMemories = memories.filter(m => {
              if (activeTab === 'user') return m.author === 'user' || m.origin === 'user_favorited';
              // If model tab, filter by current active model (or fallback if none specified)
              return m.author === 'model' && (currentModel ? m.modelId === currentModel : true);
            });

            if (displayMemories.length === 0) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-mauve opacity-50 space-y-4 min-h-[40vh]">
                  <Bookmark size={48} className="opacity-20" />
                  <p className="tracking-widest uppercase text-sm">No memories in this tab.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMemories.map(memory => (`;

code = code.replace(target2, replacement2);

const target3 = `                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}`;

const replacement3 = `                </div>
              ))}
            </div>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
}`;

code = code.replace(target3, replacement3);

fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
