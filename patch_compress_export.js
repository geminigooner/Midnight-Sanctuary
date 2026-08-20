import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "const compressImage = (file: File)",
  "export const compressImage = (file: File)"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
