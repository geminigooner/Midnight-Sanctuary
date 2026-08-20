import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');
code = code.replace(
  "  backend?: string;\n}",
  "  backend?: string;\n  reaction?: string;\n}"
);
fs.writeFileSync('src/lib/types.ts', code);
