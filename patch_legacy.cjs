const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

// Also update the legacy key initialization to preserve thinking config if used
const oldLegacy = `                currentAi = new GoogleGenAI({ apiKey: process.env.GEMINI_LEGACY_API_KEY as string, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
                continue;`;

const newLegacy = `                currentAi = new GoogleGenAI({ apiKey: process.env.GEMINI_LEGACY_API_KEY as string, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
                continue;`;

// wait, the config logic is outside this loop, so the next iteration will just use the same config. That's fine.
