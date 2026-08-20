import fs from 'fs';
let code = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');

code = code.replace(
  "import { getMotion, useReducedMotion } from '../lib/motion';",
  "import { getMotion } from '../lib/motion';\nimport { useReducedMotion } from 'motion/react';"
);

fs.writeFileSync('src/components/ProfileModal.tsx', code);
