import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(
  "let errObj = {};",
  "let errObj: any = {};"
);
fs.writeFileSync('src/lib/gemini.ts', code);
