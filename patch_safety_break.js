import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const search = `              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\\n\\n');
              } else if (chunk.candidates[0].finishReason === 'OTHER') {
                 send('data: ' + JSON.stringify({ error: 'Model blocked the response (FinishReason: OTHER).' }) + '\\n\\n');
              }`;

const replace = `              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\\n\\n');
                 break;
              } else if (chunk.candidates[0].finishReason === 'OTHER') {
                 send('data: ' + JSON.stringify({ error: 'Model blocked the response (FinishReason: OTHER).' }) + '\\n\\n');
                 break;
              }`;

code = code.replace(search, replace);
fs.writeFileSync('src/backend/chatHandler.ts', code);
