import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target1 = `    let currentMessages = [...(conversation?.messages || [])];`;
const replacement1 = `    let currentMessages = [...(conversationRef.current?.messages || [])];`;
code = code.replace(target1, replacement1);

const target2 = `    const requestConversationId = conversation?.id;`;
const replacement2 = `    const requestConversationId = conversationRef.current?.id;`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ChatArea.tsx', code);
