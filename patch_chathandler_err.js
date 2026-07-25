import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');
code = code.replace(
  "      } catch (err: any) {\n        console.error('API Error:', err);\n        try {\n          if (err?.status === 429",
  `      } catch (err: any) {\n        console.error('API Error:', err);\n        console.error('API Error detail:', JSON.stringify({\n          status: err?.status, code: err?.code, name: err?.name,\n          message: err?.message, response: err?.response?.data ?? err?.error\n        }, null, 2));\n        try {\n          if (err?.status === 429`
);
code = code.replace(
  "send(`data: ${JSON.stringify({ error: err.message || 'Unknown API Error' })}\\n\\n`);",
  "const detail = err?.error?.message || err?.message || 'Unknown API Error';\n            send(`data: ${JSON.stringify({ error: `\\[${err?.status ?? '?'}\\] ${detail}` })}\\n\\n`);"
);
fs.writeFileSync('src/backend/chatHandler.ts', code);
