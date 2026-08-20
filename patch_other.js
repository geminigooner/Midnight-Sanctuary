import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const search = `          let hasText = false;

          for await (const chunk of responseStream) {
            const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) console.log("FINISH REASON:", fr, JSON.stringify(chunk.candidates?.[0]?.safetyRatings ?? []));
            if (chunk.candidates && chunk.candidates.length > 0) {
              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\\n\\n');
                 break;
              } else if (chunk.candidates[0].finishReason === 'OTHER') {
                 send('data: ' + JSON.stringify({ error: 'Model blocked the response (FinishReason: OTHER).' }) + '\\n\\n');
                 break;
              }
            }
            if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {`;

const replace = `          let hasText = false;
          let blocked = false;

          for await (const chunk of responseStream) {
            const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) console.log("FINISH REASON:", fr, JSON.stringify(chunk.candidates?.[0]?.safetyRatings ?? []));
            if (chunk.candidates && chunk.candidates.length > 0) {
              if (chunk.candidates[0].finishReason === 'SAFETY') {
                 send('data: ' + JSON.stringify({ error: 'Safety block triggered: The model refused to generate a response due to safety filters.' }) + '\\n\\n');
                 blocked = true;
                 break;
              }
            }
            if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {`;

code = code.replace(search, replace);

const search2 = `          }

          if (!hasFunctionCalls) {
            // Preserve the exact API response, including thoughtSignature metadata.
            send(\`data: \${JSON.stringify({ type: 'model_parts', parts: modelParts })}\\n\\n\`);`;

const replace2 = `          }

          if (blocked) { safeClose(); return; }

          if (!hasFunctionCalls) {
            // Preserve the exact API response, including thoughtSignature metadata.
            send(\`data: \${JSON.stringify({ type: 'model_parts', parts: modelParts })}\\n\\n\`);`;

code = code.replace(search2, replace2);

fs.writeFileSync('src/backend/chatHandler.ts', code);
