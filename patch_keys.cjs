const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldRouting = `  const model = req.body?.model || '';
  const isGemma = model.toLowerCase().includes('gemma');
  const apiKey = isGemma ? process.env.GEMINI_API_KEY : process.env.GENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: \`\${isGemma ? 'GEMINI_API_KEY' : 'GENAI_API_KEY'} is not configured in the environment.\` });
  }`;

const newRouting = `  const model = req.body?.model || '';
  const isGemma = model.toLowerCase().includes('gemma');
  const isLegacyGemini = model.includes('gemini-2.5-pro') || model.includes('gemini-2.5-flash');
  
  let apiKey;
  let keyName;

  if (isGemma) {
    apiKey = process.env.GEMINI_API_KEY;
    keyName = 'GEMINI_API_KEY';
  } else if (isLegacyGemini) {
    apiKey = process.env.GEMINI_LEGACY_API_KEY;
    keyName = 'GEMINI_LEGACY_API_KEY';
  } else {
    apiKey = process.env.GENAI_API_KEY;
    keyName = 'GENAI_API_KEY';
  }
  
  if (!apiKey) {
    return res.status(500).json({ error: \`\${keyName} is not configured in the environment for model \${model}.\` });
  }`;

code = code.replace(oldRouting, newRouting);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
