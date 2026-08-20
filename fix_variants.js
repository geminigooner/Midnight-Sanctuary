import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "transition: { type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }",
  "transition: { type: 'spring' as const, stiffness: 400, damping: 25, mass: 0.8 }"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
