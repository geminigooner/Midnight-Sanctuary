import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;
          } else if (chunk.type === 'finish_reason') {`;

const replacement = `            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;
            if (!hasClientFulfillmentRef) {
               onAddMessage(requestConversationId, {
                 id: modelMsgId,
                 role: 'model',
                 parts: [{ text: '' }],
                 publicText: '',
                 thoughtText: '',
                 thoughtStatus: settings.model.includes('gemma') ? 'thinking' : 'complete',
                 timestamp: Date.now(),
               });
            }
          } else if (chunk.type === 'finish_reason') {`;

code = code.replace(target, replacement);

const targetRef = `      let rawTextAccumulator = '';
      let apiThoughtAccumulator = '';`;
const replacementRef = `      let rawTextAccumulator = '';
      let apiThoughtAccumulator = '';
      let hasClientFulfillmentRef = false;`;
code = code.replace(targetRef, replacementRef);

const targetClientTool = `          } else if (chunk.type === 'client_tool_call') {
            hasToolCalls = true;`;
const replacementClientTool = `          } else if (chunk.type === 'client_tool_call') {
            hasToolCalls = true;
            hasClientFulfillmentRef = true;`;
code = code.replace(targetClientTool, replacementClientTool);

fs.writeFileSync('src/components/ChatArea.tsx', code);
