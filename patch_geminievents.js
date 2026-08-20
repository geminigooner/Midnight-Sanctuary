import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace("| { type: 'finish_reason'; reason: string };", "| { type: 'finish_reason'; reason: string }\n  | { type: 'backend'; name: string };");
fs.writeFileSync('src/lib/gemini.ts', code);
