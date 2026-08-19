import fs from 'fs';

function patchFile(filename, search, replace) {
  let code = fs.readFileSync(filename, 'utf8');
  // Replace all instances
  code = code.split(search).join(replace);
  fs.writeFileSync(filename, code);
}

patchFile(
  'server.ts',
  'process.env.GEMINI_API_KEY',
  '(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY)'
);

patchFile(
  'netlify/functions/chat.ts',
  'process.env.GEMINI_API_KEY',
  '(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY)'
);

patchFile(
  'netlify/functions/models.ts',
  'process.env.GEMINI_API_KEY',
  '(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY)'
);

