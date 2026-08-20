import fs from 'fs';

// Fix App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/store\.settings\.profile/g, 'store.profile');
fs.writeFileSync('src/App.tsx', appCode);

// Fix gemini.ts types
let geminiCode = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const target = `  | { type: 'backend'; name: string }`;
const replacement = `  | { type: 'backend'; name: string }
  | { type: 'client_tool_call'; name: string; callId: string }`;
geminiCode = geminiCode.replace(target, replacement);
fs.writeFileSync('src/lib/gemini.ts', geminiCode);

