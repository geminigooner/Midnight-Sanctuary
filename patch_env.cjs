const fs = require('fs');
let env = fs.readFileSync('.env.example', 'utf8');

if (!env.includes('GENAI_API_KEY')) {
  env += '\n# GENAI_API_KEY: Required for newer Gemini models.\nGENAI_API_KEY="MY_GENAI_API_KEY"\n';
}
if (!env.includes('GEMINI_LEGACY_API_KEY')) {
  env += '\n# GEMINI_LEGACY_API_KEY: Required for Gemini 2.5 Pro and Flash.\nGEMINI_LEGACY_API_KEY="MY_LEGACY_API_KEY"\n';
}

fs.writeFileSync('.env.example', env);
console.log('Patched .env.example');
