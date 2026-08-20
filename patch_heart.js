import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "onFavorite={(content) => {\\n              onAddMemory(content, 'user_favorited');\\n              onAddEventLog('User favorited a message.');\\n            }}",
  "onFavorite={(content) => {\\n              onAddEventLog('User favorited a message.');\\n            }}"
);

code = code.replace(
  "title={favorited ? 'Saved to Memories' : 'Favorite / Save to Memory'}",
  "title={favorited ? 'Favorited' : 'Favorite'}"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
