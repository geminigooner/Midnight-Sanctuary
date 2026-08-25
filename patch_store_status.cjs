const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
  "if (user && updates.status === 'complete') {",
  "if (user && updates.thoughtStatus === 'complete') {"
);

fs.writeFileSync('src/lib/store.ts', code);
console.log('Patched store.ts');
