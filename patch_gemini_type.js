import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const search = `  | { type: 'memory'; content: string; why_it_matters?: string }`;
const replace = `  | { type: 'memory'; content: string; why_it_matters?: string }
  | { type: 'user_note'; note: string }`;
code = code.replace(search, replace);

fs.writeFileSync('src/lib/gemini.ts', code);
