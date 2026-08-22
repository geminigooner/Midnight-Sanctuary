import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `onUpdateSettings: (settings: AppSettings) => void;`;
const replacement = `onUpdateSettings: (settings: Partial<AppSettings>) => void;`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea onUpdateSettings interface");
