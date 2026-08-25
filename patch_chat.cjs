const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

// 1. Add Gemini 3 Config
const gemmaConfig = `          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
            config.maxOutputTokens = Math.max(config.maxOutputTokens ?? 4096, 16384);
          }`;

const gemini3Config = `          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
            config.maxOutputTokens = Math.max(config.maxOutputTokens ?? 4096, 16384);
          }

          if (model.includes('gemini-3')) {
            config.thinkingConfig = {
              thinkingLevel: model.includes('flash') ? ThinkingLevel.MEDIUM : ThinkingLevel.HIGH,
              includeThoughts: true
            };
          }`;

code = code.replace(gemmaConfig, gemini3Config);

// 2. Fix the legacy fallback matcher
const oldMatcher = `const isGemini3Preview = model.includes('gemini-3.0-flash') || model.includes('gemini-3.1-pro');`;
const newMatcher = `const isGemini3Preview = model.includes('gemini-3-flash-preview') || model.includes('gemini-3.1-pro');`;
code = code.replace(oldMatcher, newMatcher);

// 3. Add stream latency and status logging
const oldLoop = `          for await (const chunk of responseStream) {
            const fr = chunk.candidates?.[0]?.finishReason;`;

const newLoop = `          const requestStartTime = Date.now();
          let firstTokenTime = null;
          let streamStatus = 'normal';

          try {
            for await (const chunk of responseStream) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
                console.log(\`[Stream] First token latency: \${firstTokenTime - requestStartTime}ms for model \${model}\`);
              }
              const fr = chunk.candidates?.[0]?.finishReason;`;

code = code.replace(oldLoop, newLoop);

const oldEndOfLoop = `              }
            }
          }
          if (blocked) { safeClose(); return; }`;

const newEndOfLoop = `              }
            }
          } catch (e) {
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
