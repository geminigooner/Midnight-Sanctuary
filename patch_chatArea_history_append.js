import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;
            onAddMessage(requestConversationId, {
              id: modelMsgId,
              role: 'model',
              parts: [{ text: '' }],
              publicText: '',
              thoughtText: '',
              thoughtStatus: settings.model.includes('gemma') ? 'thinking' : 'complete',
              timestamp: Date.now(),
            });`;

const replacement = `            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ChatArea.tsx', code);
