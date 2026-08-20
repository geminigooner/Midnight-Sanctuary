import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "updateModelMessage(currentModelText, currentModelThought, status);",
  "updateModelMessage(currentModelText, currentModelThought, status as any);"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
