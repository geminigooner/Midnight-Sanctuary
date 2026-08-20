import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const target = `    const memory = {
      id: Math.random().toString(36).substring(2, 9),
      content: newMemory.trim(),
      createdAt: Date.now()
    };`;

const replacement = `    const memory = {
      id: Math.random().toString(36).substring(2, 9),
      content: newMemory.trim(),
      createdAt: Date.now(),
      author: 'user' as const
    };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Settings.tsx', code);
