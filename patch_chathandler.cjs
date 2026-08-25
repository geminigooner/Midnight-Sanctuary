const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const oldCode = `          while (true) {
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

const newCode = `          let useLegacyFallback = false;
          let currentAi = ai;

          while (true) {
            try {
              responseStream = await currentAi.models.generateContentStream({
                model: model,
                contents: currentMessages,
                config: {
                   ...config,
                   abortSignal
                }
              });
              break;
            } catch (err: any) {
              const status = err?.status;
              
              // Only fallback for Gemini 3 Flash Preview and Gemini 3.1 Pro Preview models
              const isGemini3Preview = model.includes('gemini-3.0-flash') || model.includes('gemini-3.1-pro');
              const isFallbackEligibleError = status === 429 || status === 401 || status === 403 || status === 404;
              const hasLegacyKey = !!process.env.GEMINI_LEGACY_API_KEY;

              if (isGemini3Preview && isFallbackEligibleError && hasLegacyKey && !useLegacyFallback) {
                console.warn(\`[Fallback] Primary API key failed with \${status} for \${model}. Retrying with GEMINI_LEGACY_API_KEY.\`);
                useLegacyFallback = true;
                currentAi = new GoogleGenAI({ apiKey: process.env.GEMINI_LEGACY_API_KEY as string, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
                continue;
              }

              if ((status === 500 || status === 503) && retries < backoffTimes.length) {
                console.error(\`API Error \${status}. Retrying in \${backoffTimes[retries]}ms... (Attempt \${retries + 1}/3)\`);
                await new Promise(resolve => setTimeout(resolve, backoffTimes[retries]));
                retries++;
              } else {
                throw err;
              }
            }
          }`;

if (!code.includes("useLegacyFallback = true;")) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/backend/chatHandler.ts', code);
  console.log('Patched chatHandler.ts');
} else {
  console.log('Already patched');
}
