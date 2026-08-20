import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "            onFavorite={(content) => {\\n              onAddMemory(content, 'user_favorited');\\n              onAddEventLog('User favorited a message.');\\n            }}",
  "            onFavorite={(content) => {\\n              onAddEventLog('User favorited a message.');\\n            }}"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
