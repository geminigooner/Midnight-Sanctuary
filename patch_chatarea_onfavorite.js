import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `            onFavorite={(content) => {
              onAddEventLog('User favorited a message.');
            }}`;

const replacement = `            onFavorite={(content) => {
              onAddEventLog('User favorited a message.');
              onAddMemory(content, 'user_favorited', 'user', undefined, 'User Saved Memory');
            }}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
