import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          onSelect={(id) => {
            store.setCurrentId(id);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}`;

const replacement = `          onSelect={(id) => {
            const chat = store.conversations.find(c => c.id === id);
            if (chat && chat.modelId) {
              store.updateSettings({ model: chat.modelId });
            }
            store.setCurrentId(id);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
