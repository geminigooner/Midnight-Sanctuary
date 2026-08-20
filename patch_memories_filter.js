import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

const target = `            const displayMemories = memories.filter(m => {
              if (activeTab === 'user') return m.author === 'user' || m.origin === 'user_favorited';
              // If model tab, filter by current active model (or fallback if none specified)
              return m.author === 'model' && (currentModel ? m.modelId === currentModel : true);
            });`;

const replacement = `            const displayMemories = memories.filter(m => {
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

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
