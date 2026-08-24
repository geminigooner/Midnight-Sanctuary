import fs from 'fs';

// Patch ChatArea.tsx
let chatArea = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Remove triggerHaptic definition
chatArea = chatArea.replace(/export const triggerHaptic = \(type: 'light' \| 'medium' \| 'heavy' = 'light'\) => \{[\s\S]*?\};\n/, '');

// Add import
chatArea = chatArea.replace("import { MessageBubble } from './MessageBubble';", "import { MessageBubble } from './MessageBubble';\nimport { triggerHaptic } from '../lib/haptics';");

fs.writeFileSync('src/components/ChatArea.tsx', chatArea);

// Patch MessageBubble.tsx
let msgBubble = fs.readFileSync('src/components/MessageBubble.tsx', 'utf8');
msgBubble = msgBubble.replace("import { triggerHaptic } from './ChatArea';", "import { triggerHaptic } from '../lib/haptics';");
fs.writeFileSync('src/components/MessageBubble.tsx', msgBubble);
console.log("Patched haptics");
