import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const target = `            // tools: gemmaTools, // TEMPORARILY DISABLED for debugging
          };

          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
          }

          console.log(\`ROUND \${round} CONTENTS:\`, JSON.stringify(currentMessages, null, 2));
          const responseStream = await ai.models.generateContentStream({
            model: model,
            contents: currentMessages,
            config: {
               ...config,
               abortSignal
            }
          });`;

const replacement = `            tools: gemmaTools,
          };

          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
          }

          console.log(\`ROUND \${round} CONTENTS:\`, JSON.stringify(currentMessages, null, 2));
          
          let responseStream: any;
          let retries = 0;
          const backoffTimes = [1000, 2500, 5000];
          
          while (true) {
            try {
              responseStream = await ai.models.generateContentStream({
                model: model,
                contents: currentMessages,
                config: {
                   ...config,
                   abortSignal
                }
              });
              break;
            } catch (err: any) {
              if ((err?.status === 500 || err?.status === 503) && retries < backoffTimes.length) {
                console.error(\`API Error \${err?.status}. Retrying in \${backoffTimes[retries]}ms... (Attempt \${retries + 1}/3)\`);
                await new Promise(resolve => setTimeout(resolve, backoffTimes[retries]));
                retries++;
              } else {
                throw err;
              }
            }
          }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/backend/chatHandler.ts', code);
