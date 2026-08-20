import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Fix 1: Don't add empty userMsg on resume tool call
const target1 = `    const userMsg: Message = { id: uuidv4(), role: 'user', parts, timestamp: now };
    currentMessages.push(userMsg);
    onAddMessage(requestConversationId, userMsg);`;

const replacement1 = `    if (!isResumeToolCall) {
      const userMsg: Message = { id: uuidv4(), role: 'user', parts, timestamp: now };
      currentMessages.push(userMsg);
      onAddMessage(requestConversationId, userMsg);
    }`;

code = code.replace(target1, replacement1);

// Fix 2: Safety around msgs[1]
const target2 = `            onAddMessage(requestConversationId, {
              id: uuidv4(),
              role: 'user',
              parts: msgs[1].parts,
              timestamp: Date.now(),
            });`;

const replacement2 = `            if (msgs.length > 1 && msgs[1]) {
              onAddMessage(requestConversationId, {
                id: uuidv4(),
                role: 'user',
                parts: msgs[1].parts,
                timestamp: Date.now(),
              });
            }`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ChatArea.tsx', code);
