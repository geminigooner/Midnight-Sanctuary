import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target = `  const filtered = conversations.filter(c => 
    (c.modelId === currentModel || (!c.modelId && currentModel.includes('gemma'))) && // Legacy conversations default to Gemma
    (c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())))
  );`;

const replacement = `  const filtered = conversations.filter(c => 
    (c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())))
  );`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Patched Sidebar.tsx");
