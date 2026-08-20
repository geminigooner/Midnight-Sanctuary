import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');
code = code.replace("finishReason?: string;", "finishReason?: string;\n  backend?: string;");
fs.writeFileSync('src/lib/types.ts', code);
