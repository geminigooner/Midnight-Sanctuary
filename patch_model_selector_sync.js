import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `onChange={(e) => onUpdateSettings({ model: e.target.value })}`;
const replacement = `onChange={(e) => {
                       onUpdateSettings({ model: e.target.value });
                       if (conversation) {
                         onUpdate(conversation.id, { modelId: e.target.value });
                       }
                     }}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea model selector sync");
