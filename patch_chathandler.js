import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');
code = code.replace(
  /functionResponses\.push\(\{\n\s*functionResponse: \{\n\s*id: call\.id \|\| call\.name,\n\s*name: call\.name,\n\s*response: \{ result: "ok" \}\n\s*\}\n\s*\}\);/,
  `const fr: any = { name: call.name, response: { result: "ok" } };
                  if (call.id) fr.id = call.id; // only echo an id the model actually sent
                  functionResponses.push({ functionResponse: fr });`
);
fs.writeFileSync('src/backend/chatHandler.ts', code);
