import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');

code = code.replace("maxOutputTokens: 4096,", "maxOutputTokens: 12000,");

fs.writeFileSync('src/lib/types.ts', code);
console.log("Patched types");
