import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const search = `          for await (const chunk of responseStream) {
            if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
              for (const part of chunk.candidates[0].content.parts) {`;

const replace = `          for await (const chunk of responseStream) {
            if (chunk.candidates && chunk.candidates.length > 0) {
              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\\n\\n');
              } else if (chunk.candidates[0].finishReason === 'OTHER') {
                 send('data: ' + JSON.stringify({ error: 'Model blocked the response (FinishReason: OTHER).' }) + '\\n\\n');
              }
            }
            if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
              for (const part of chunk.candidates[0].content.parts) {`;

code = code.replace(search, replace);
fs.writeFileSync('src/backend/chatHandler.ts', code);
