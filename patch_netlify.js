import fs from 'fs';
let code = fs.readFileSync('netlify/functions/chat.ts', 'utf8');
code = code.replace(
  'const stream = createChatStream(reqBody, apiKey);',
  'const stream = createChatStream(reqBody, apiKey, req.signal);'
);
fs.writeFileSync('netlify/functions/chat.ts', code);
