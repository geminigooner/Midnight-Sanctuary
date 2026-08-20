import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const target = `                  let requireClientFulfillment = false;
                  if (call.name === 'view_user_profile') {
                    send(\`data: \${JSON.stringify({ type: 'client_tool_call', name: call.name, callId: call.id })}\\n\\n\`);
                    requireClientFulfillment = true;
                    hasFunctionCalls = true;
                  }`;

const replacement = `                  let requireClientFulfillment = false;
                  if (call.name === 'view_user_profile' && !hasClientFulfillmentSent) {
                    send(\`data: \${JSON.stringify({ type: 'client_tool_call', name: call.name, callId: call.id })}\\n\\n\`);
                    requireClientFulfillment = true;
                    hasClientFulfillmentSent = true;
                    hasFunctionCalls = true;
                  }`;

const targetVar = `          let hasFunctionCalls = false;`;
const replacementVar = `          let hasFunctionCalls = false;
          let hasClientFulfillmentSent = false;`;

code = code.replace(target, replacement);
code = code.replace(targetVar, replacementVar);

fs.writeFileSync('src/backend/chatHandler.ts', code);
