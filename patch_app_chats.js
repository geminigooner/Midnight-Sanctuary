import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `        <Sidebar 
          conversations={store.conversations}`;
const replacement1 = `        <Sidebar 
          conversations={store.conversations}
          currentModel={store.settings.model}`;
code = code.replace(target1, replacement1);

const target2 = `        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-obsidian text-mauve/50">
            <div className="w-16 h-16 rounded-2xl bg-ink border border-glass-border flex items-center justify-center mb-4">
              <span className="text-2xl font-serif italic text-copper">S</span>
            </div>
            <p className="tracking-widest uppercase text-sm mb-6">Midnight Sanctuary</p>
            <button 
              onClick={store.createConversation}
              className="px-6 py-2.5 bg-copper text-obsidian rounded-full font-medium hover:bg-copper-light transition-colors"
            >
              Start New Link
            </button>
          </div>
        )}
      </div>`;
const replacement2 = `        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-obsidian text-mauve/50 relative">
             <div className="absolute top-4 left-4 lg:hidden">
               <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-glass rounded-lg text-mauve">
                 <Menu size={20} />
               </button>
             </div>
            <div className="w-16 h-16 rounded-2xl bg-ink border border-glass-border flex items-center justify-center mb-4">
              <span className="text-2xl font-serif italic text-copper">S</span>
            </div>
            <p className="tracking-widest uppercase text-sm mb-6">No active link for {store.settings.model.split('/').pop()}</p>
            <button 
              onClick={store.createConversation}
              className="px-6 py-2.5 bg-copper text-obsidian rounded-full font-medium hover:bg-copper-light transition-colors"
            >
              Start New Link
            </button>
          </div>
        )}
      </div>`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', code);
