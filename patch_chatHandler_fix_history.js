import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const target = `          const hasClientFulfillment = chunk.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall?.name === 'view_user_profile');
          if (hasClientFulfillment) {
            // End the stream early so the client can fulfill the tool and resume the chat.
            break;
          }`;

const replacement = `          const hasClientFulfillment = chunk.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall?.name === 'view_user_profile');
          if (hasClientFulfillment) {
            // End the stream early so the client can fulfill the tool and resume the chat.
            const newMessages = [
              { role: 'model', parts: modelParts }
            ];
            currentMessages.push(...newMessages);
            send(\`data: \${JSON.stringify({ type: 'history_append', messages: newMessages })}\\n\\n\`);
            break;
          }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/backend/chatHandler.ts', code);
