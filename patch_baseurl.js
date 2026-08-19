import fs from 'fs';

function patchFile(filename, search, replace) {
  let code = fs.readFileSync(filename, 'utf8');
  code = code.replace(search, replace);
  fs.writeFileSync(filename, code);
}

patchFile(
  'src/backend/chatHandler.ts',
  'const ai = new GoogleGenAI({ apiKey });',
  "const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });"
);

patchFile(
  'server.ts',
  'const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });',
  "const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });"
);

patchFile(
  'netlify/functions/models.ts',
  'const ai = new GoogleGenAI({ apiKey });',
  "const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });"
);

