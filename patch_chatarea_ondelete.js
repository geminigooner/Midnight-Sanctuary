import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = `            onFavorite={(content) => {
              onAddMemory(content, 'user_favorited');
              onAddEventLog('User favorited a message.');
            }}
            onImageClick={(url) => setSelectedImage(url)}
          />`;

const replace = `            onFavorite={(content) => {
              onAddMemory(content, 'user_favorited');
              onAddEventLog('User favorited a message.');
            }}
            onImageClick={(url) => setSelectedImage(url)}
            onDelete={() => onRemoveMessage(conversation.id, msg.id)}
          />`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/ChatArea.tsx', code);
