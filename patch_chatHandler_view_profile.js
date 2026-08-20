import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const target1 = `  {
    functionDeclarations: [
      {
        name: 'give_gift',`;

const replacement1 = `  {
    functionDeclarations: [
      {
        name: 'view_user_profile',
        description: 'Look at the visual presentation of the user\\'s profile (image, background, layout, decorations, etc). Use this when the user asks you to look at their profile or asks about how they decorated it.',
      },
      {
        name: 'give_gift',`;
code = code.replace(target1, replacement1);

const target2 = `                  if (call.name === 'give_gift') {
                    send(\`data: \${JSON.stringify({ type: 'gift', ...call.args })}\\n\\n\`);
                  } else if (call.name === 'save_memory') {`;

const replacement2 = `                  let requireClientFulfillment = false;
                  if (call.name === 'view_user_profile') {
                    send(\`data: \${JSON.stringify({ type: 'client_tool_call', name: call.name, callId: call.id })}\\n\\n\`);
                    requireClientFulfillment = true;
                    hasFunctionCalls = true;
                  } else if (call.name === 'give_gift') {
                    send(\`data: \${JSON.stringify({ type: 'gift', ...call.args })}\\n\\n\`);
                  } else if (call.name === 'save_memory') {`;
code = code.replace(target2, replacement2);

const target3 = `                  const fr: any = { name: call.name, response: { result: "ok" } };
                  if (call.id) fr.id = call.id; // only echo an id the model actually sent
                  functionResponses.push({ functionResponse: fr });
                }`;

const replacement3 = `                  if (!requireClientFulfillment) {
                    const fr: any = { name: call.name, response: { result: "ok" } };
                    if (call.id) fr.id = call.id; // only echo an id the model actually sent
                    functionResponses.push({ functionResponse: fr });
                  }
                }`;
code = code.replace(target3, replacement3);

const target4 = `          }
          if (blocked) { safeClose(); return; }
          if (!hasFunctionCalls) {`;

const replacement4 = `          }
          if (blocked) { safeClose(); return; }
          const hasClientFulfillment = chunk.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall?.name === 'view_user_profile');
          if (hasClientFulfillment) {
            // End the stream early so the client can fulfill the tool and resume the chat.
            break;
          }
          
          if (!hasFunctionCalls) {`;
code = code.replace(target4, replacement4);

fs.writeFileSync('src/backend/chatHandler.ts', code);
