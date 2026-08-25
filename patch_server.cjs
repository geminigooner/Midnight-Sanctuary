const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldKeyLogic = `  const apiKey = (process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in the environment.' });
  }`;

const newKeyLogic = `  const isGemma = req.body?.model?.toLowerCase().includes('gemma');
  const apiKey = isGemma ? process.env.GEMINI_API_KEY : process.env.GENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: \`\${isGemma ? 'GEMINI_API_KEY' : 'GENAI_API_KEY'} is not configured in the environment.\` });
  }`;

code = code.replace(oldKeyLogic, newKeyLogic);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
