import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  "<MemoriesArchive memories={store.settings.memories} onClose={() => setMemoriesOpen(false)} onRemoveMemory={store.removeMemory} />",
  "<MemoriesArchive memories={store.settings.memories} onClose={() => setMemoriesOpen(false)} onRemoveMemory={store.removeMemory} currentModel={store.settings.model} />"
);
fs.writeFileSync('src/App.tsx', code);
