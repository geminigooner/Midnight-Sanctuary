import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = `          } else if (chunk.type === 'memory') {
            hasToolCalls = true;
            onAddMemory(chunk.content, 'gemma_initiated');
          } else if (chunk.type === 'eventLog') {`;

const replace = `          } else if (chunk.type === 'memory') {
            hasToolCalls = true;
            onAddMemory(chunk.content, 'gemma_initiated');
          } else if (chunk.type === 'user_note') {
            hasToolCalls = true;
            onAddGemmaNote(chunk.note);
          } else if (chunk.type === 'eventLog') {`;

code = code.replace(search, replace);

fs.writeFileSync('src/components/ChatArea.tsx', code);
