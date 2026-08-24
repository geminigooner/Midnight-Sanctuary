import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
code = code.replace(
  "const modelConversations = conversations; // TEMP: removed filter to check if conversations are hidden",
  "const modelConversations = conversations;"
);
fs.writeFileSync('src/components/Sidebar.tsx', code);
