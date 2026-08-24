import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
code = code.replace(
  "const modelConversations = conversations.filter(c => !c.modelId || c.modelId === currentModel);",
  "const modelConversations = conversations; // TEMP: removed filter to check if conversations are hidden"
);
fs.writeFileSync('src/components/Sidebar.tsx', code);
