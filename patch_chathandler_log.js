import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');
code = code.replace(
  "          const responseStream = await ai.models.generateContentStream({",
  "          console.log(`ROUND ${round} CONTENTS:`, JSON.stringify(currentMessages, null, 2));\n          const responseStream = await ai.models.generateContentStream({"
);
fs.writeFileSync('src/backend/chatHandler.ts', code);
