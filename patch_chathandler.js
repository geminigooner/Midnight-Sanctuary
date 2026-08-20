import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const searchConfig = `          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
          }`;

const replaceConfig = `          if (model.includes('gemma-4')) {
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true
            };
            config.maxOutputTokens = Math.max(config.maxOutputTokens ?? 4096, 16384);
          }`;

const searchLoop = `          for await (const chunk of responseStream) {`;

const replaceLoop = `          for await (const chunk of responseStream) {
            const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) console.log("FINISH REASON:", fr, JSON.stringify(chunk.candidates?.[0]?.safetyRatings ?? []));`;

code = code.replace(searchConfig, replaceConfig);
code = code.replace(searchLoop, replaceLoop);
fs.writeFileSync('src/backend/chatHandler.ts', code);
