import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target1 = `  const handleSend = async (textToAnalyse: string = input, replaceIndex?: number, isResumeToolCall?: boolean) => {
    const requestConversationId = conversationRef.current?.id;`;

const replacement1 = `  const handleSend = async (textToAnalyse: string = input, replaceIndex?: number, additionalMessages?: Message[]) => {
    const requestConversationId = conversationRef.current?.id;`;

code = code.replace(target1, replacement1);

const target2 = `    if (!textToAnalyse.trim() && attachments.length === 0 && !isResumeToolCall) {
      return;
    }`;

const replacement2 = `    if (!textToAnalyse.trim() && attachments.length === 0 && (!additionalMessages || additionalMessages.length === 0)) {
      return;
    }`;
code = code.replace(target2, replacement2);

const target3 = `    if (!isResumeToolCall) {
      const userMsg: Message = { id: uuidv4(), role: 'user', parts, timestamp: now };
      currentMessages.push(userMsg);
      onAddMessage(requestConversationId, userMsg);
    }`;

const replacement3 = `    if (!additionalMessages || additionalMessages.length === 0) {
      const userMsg: Message = { id: uuidv4(), role: 'user', parts, timestamp: now };
      currentMessages.push(userMsg);
      onAddMessage(requestConversationId, userMsg);
    } else {
      currentMessages.push(...additionalMessages);
      additionalMessages.forEach(msg => onAddMessage(requestConversationId, msg));
    }`;
code = code.replace(target3, replacement3);

const target4 = `                 onAddMessage(requestConversationId, functionResponseMsg as any);
                 
                 // Automatically resume the chat loop
                 setTimeout(() => handleSend('', undefined, true), 100);`;

const replacement4 = `                 handleSend('', undefined, [functionResponseMsg as any]);`;
code = code.replace(target4, replacement4);

const target5 = `                 onAddMessage(requestConversationId, functionResponseMsg as any);
                 setTimeout(() => handleSend('', undefined, true), 100);`;

const replacement5 = `                 handleSend('', undefined, [functionResponseMsg as any]);`;
code = code.replace(target5, replacement5);

fs.writeFileSync('src/components/ChatArea.tsx', code);
