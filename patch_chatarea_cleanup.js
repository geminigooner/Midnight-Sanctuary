import fs from 'fs';
let chatArea = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Remove unused imports in ChatArea
chatArea = chatArea.replace("import { ThoughtBubble } from './ThoughtBubble';\n", "");
chatArea = chatArea.replace("import { StreamingMarkdown } from './StreamingMarkdown';\n", "");
chatArea = chatArea.replace("import { getPublicMessageText, getThoughtMessageText } from '../lib/types';\n", "");

fs.writeFileSync('src/components/ChatArea.tsx', chatArea);
console.log("Cleaned up ChatArea imports");
