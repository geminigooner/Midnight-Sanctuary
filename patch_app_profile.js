import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const search = "        onAddGift={store.addGift}\n        onAddMemory={store.addMemory}\n        onAddEventLog={store.addEventLog}\n      />";
const replace = "        profile={store.profile}\n        onAddGift={store.addGift}\n        onAddMemory={store.addMemory}\n        onAddEventLog={store.addEventLog}\n        onAddGemmaNote={store.addGemmaNote}\n      />";
code = code.replace(search, replace);

fs.writeFileSync('src/App.tsx', code);
