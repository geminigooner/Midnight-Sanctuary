const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const oldEndOfLoop = `              }
            }
          }

          if (blocked) { safeClose(); return; }`;

const newEndOfLoop = `              }
            }
          } catch (e: any) {
            if (e.name === 'AbortError' || abortSignal?.aborted) {
               streamStatus = 'aborted';
               console.warn(\`[Stream] Aborted for model \${model} after \${Date.now() - requestStartTime}ms\`);
               throw e;
            } else {
               streamStatus = 'errored';
               console.error(\`[Stream] Errored for model \${model}:\`, e.message);
               throw e;
            }
          } finally {
            if (streamStatus === 'normal') {
               console.log(\`[Stream] Ended normally for model \${model} after \${Date.now() - requestStartTime}ms. First token latency: \${firstTokenTime ? firstTokenTime - requestStartTime : 'N/A'}ms.\`);
            }
          }

          if (blocked) { safeClose(); return; }`;

code = code.replace(oldEndOfLoop, newEndOfLoop);

fs.writeFileSync('src/backend/chatHandler.ts', code);
console.log("Patched chatHandler.ts");
