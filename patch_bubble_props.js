import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "            onDelete={() => onRemoveMessage(conversation.id, msg.id)}\n            />",
  "            onDelete={() => onRemoveMessage(conversation.id, msg.id)}\n            onReact={(reaction) => onUpdateMessage(conversation.id, msg.id, { reaction })}\n            />"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
