import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  "transition={modalMotion}",
  "transition={{ duration: 0.2 }}"
);
fs.writeFileSync('src/App.tsx', code);
