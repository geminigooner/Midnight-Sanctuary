const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const oldForceCF = `          if (forceCloudflare) {
            throw new Error("Forcing Cloudflare fallback for testing");
          }`;

const newForceCF = `          if (forceCloudflare) {
            if (model.toLowerCase().includes('gemma')) {
              throw new Error("Forcing Cloudflare fallback for testing");
            } else {
              // Ignore forceCloudflare for Gemini
            }
          }`;

code = code.replace(oldForceCF, newForceCF);

const oldCFFallback = `        try {
          console.log("Attempting Cloudflare fallback...");`;

const newCFFallback = `        try {
          if (!model.toLowerCase().includes('gemma')) {
            throw new Error("Cloudflare fallback is only allowed for Gemma models.");
          }
          console.log("Attempting Cloudflare fallback...");`;

code = code.replace(oldCFFallback, newCFFallback);

fs.writeFileSync('src/backend/chatHandler.ts', code);
console.log('Patched chatHandler.ts');
