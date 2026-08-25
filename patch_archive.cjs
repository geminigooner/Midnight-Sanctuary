const fs = require('fs');
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

const oldTabsState = `  const [activeTab, setActiveTab] = useState<'model' | 'user'>('model');`;
const newTabsState = `  const [activeTab, setActiveTab] = useState<'model' | 'user' | 'legacy'>('model');`;

code = code.replace(oldTabsState, newTabsState);

const oldTabsHTML = `        <div className="flex border-b-[3px] border-[#2C194D]">
          <button
            onClick={() => setActiveTab('model')}
            className={\`flex-1 p-4 text-sm font-medium tracking-wide transition-colors \${activeTab === 'model' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}\`}
          >
            Model Memories
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={\`flex-1 p-4 text-sm font-medium tracking-wide transition-colors \${activeTab === 'user' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}\`}
          >
            User Saved Memories
          </button>
        </div>`;

const newTabsHTML = `        <div className="flex border-b-[3px] border-[#2C194D] overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('model')}
            className={\`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap \${activeTab === 'model' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}\`}
          >
            Model Memories
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={\`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap \${activeTab === 'user' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}\`}
          >
            User Saved
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={\`flex-1 min-w-[120px] p-4 text-sm font-medium tracking-wide transition-colors whitespace-nowrap \${activeTab === 'legacy' ? 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]' : 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold'}\`}
          >
            Legacy / Unassigned
          </button>
        </div>`;

code = code.replace(oldTabsHTML, newTabsHTML);

const oldFilterLogic = `            const displayMemories = memories.filter(m => {
              const isModelAuthor = m.author === 'model' || m.origin === 'gemma_initiated';
              if (activeTab === 'user') return !isModelAuthor;
              
              // If model tab, filter by current active model.
              // If the memory has no modelId (older memory), let it show up or we can strictly filter.
              // We'll strictly filter if modelId exists, otherwise show it as legacy.
              if (m.modelId) {
                return m.modelId === currentModel;
              }
              return true; // Legacy memories without modelId
            });`;

const newFilterLogic = `            const displayMemories = memories.filter(m => {
              const isExplicitUser = m.author === 'user' || m.origin === 'user_favorited' || m.origin === 'user_saved';
              const isExplicitModel = m.author === 'model' || m.origin === 'gemma_initiated';
              
              if (activeTab === 'user') {
                return isExplicitUser;
              }
              
              if (activeTab === 'model') {
                return isExplicitModel && m.modelId === currentModel;
              }
              
              // legacy tab
              if (isExplicitModel && m.modelId !== currentModel) {
                // Another model's memory (also fits in legacy/unassigned for this view, or we can just say "unassigned")
                // Wait, if it belongs to another model, it shouldn't be under legacy/unassigned, but for now we put it there so it's not hidden.
                return true; 
              }
              if (!isExplicitUser && !isExplicitModel) {
                return true; // True legacy without enough metadata
              }
              if (isExplicitModel && !m.modelId) {
                return true; // Model memory without modelId
              }
              return false;
            });`;

code = code.replace(oldFilterLogic, newFilterLogic);

const oldBadge = `                      <span className="text-xs text-[#F198B7] uppercase tracking-widest font-bold bg-[#2C194D] px-2 py-1 rounded w-max">
                        {memory.author === 'model' ? (memory.modelId || 'From Model') : (memory.origin === 'gemma_initiated' ? 'From Gemma' : 'Recorded')}
                      </span>`;

const newBadge = `                      <span className="text-xs text-[#F198B7] uppercase tracking-widest font-bold bg-[#2C194D] px-2 py-1 rounded w-max">
                        {(() => {
                           const isExplicitUser = memory.author === 'user' || memory.origin === 'user_favorited' || memory.origin === 'user_saved';
                           const isExplicitModel = memory.author === 'model' || memory.origin === 'gemma_initiated';
                           if (isExplicitUser) return 'User Saved';
                           if (isExplicitModel) return memory.modelId ? \`Model: \${memory.modelId}\` : 'Model: Unknown';
                           return 'Legacy / Unassigned';
                        })()}
                      </span>`;

code = code.replace(oldBadge, newBadge);

fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
console.log('Patched MemoriesArchive.tsx');
