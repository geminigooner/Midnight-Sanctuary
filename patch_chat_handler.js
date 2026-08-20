import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

code = code.replace(
  "                  } else if (call.name === 'save_memory') {\n                    send(`data: ${JSON.stringify({ type: 'memory', ...call.args })}\\n\\n`);",
  "                  } else if (call.name === 'save_memory') {\n                    send(`data: ${JSON.stringify({ type: 'memory', ...call.args, author: 'model', modelId: model })}\\n\\n`);"
);

fs.writeFileSync('src/backend/chatHandler.ts', code);
