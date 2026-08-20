import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const targetImport = `import { Send, Image as ImageIcon, X, Trash2, Edit2, Gift, Sparkles, ImagePlus, User, Loader2, Maximize2 } from 'lucide-react';`;
const replacementImport = `import { Send, Image as ImageIcon, X, Trash2, Edit2, Gift, Sparkles, ImagePlus, User, Loader2, Maximize2 } from 'lucide-react';
import html2canvas from 'html2canvas';`;
code = code.replace(targetImport, replacementImport);

const targetHandleSend1 = `  const handleSend = async (textToAnalyse: string = input, replaceIndex?: number) => {
    const requestConversationId = conversation?.id;`;
const replacementHandleSend1 = `  const handleSend = async (textToAnalyse: string = input, replaceIndex?: number, isResumeToolCall?: boolean) => {
    const requestConversationId = conversation?.id;`;
code = code.replace(targetHandleSend1, replacementHandleSend1);

const targetHandleSend2 = `    if (!textToAnalyse.trim() && attachments.length === 0) {
      return;
    }`;
const replacementHandleSend2 = `    if (!textToAnalyse.trim() && attachments.length === 0 && !isResumeToolCall) {
      return;
    }`;
code = code.replace(targetHandleSend2, replacementHandleSend2);

const targetStream = `          } else if (chunk.type === 'eventLog') {
            hasToolCalls = true;
            onAddEventLog(chunk.description);
          } else if (chunk.type === 'model_parts') {`;

const replacementStream = `          } else if (chunk.type === 'eventLog') {
            hasToolCalls = true;
            onAddEventLog(chunk.description);
          } else if (chunk.type === 'client_tool_call') {
            hasToolCalls = true;
            const element = document.getElementById('capture-profile-view');
            if (element) {
               try {
                 const canvas = await html2canvas(element, { backgroundColor: null });
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                 const base64Data = dataUrl.split(',')[1];
                 
                 // Append the tool response message
                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [{
                       functionResponse: {
                          name: chunk.name,
                          id: chunk.callId,
                          response: {
                             result: "image attached",
                             image: { mimeType: 'image/jpeg', data: base64Data }
                          }
                       }
                    }],
                    timestamp: Date.now()
                 };
                 onAddMessage(requestConversationId, functionResponseMsg as any);
                 
                 // Automatically resume the chat loop
                 setTimeout(() => handleSend('', undefined, true), 100);
               } catch (e) {
                 console.error("Failed to capture profile view", e);
               }
            } else {
               // Profile view not found, send graceful failure
                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [{
                       functionResponse: {
                          name: chunk.name,
                          id: chunk.callId,
                          response: {
                             result: "The visual profile view cannot be captured right now or the selected model does not support vision."
                          }
                       }
                    }],
                    timestamp: Date.now()
                 };
                 onAddMessage(requestConversationId, functionResponseMsg as any);
                 setTimeout(() => handleSend('', undefined, true), 100);
            }
          } else if (chunk.type === 'model_parts') {`;

code = code.replace(targetStream, replacementStream);

fs.writeFileSync('src/components/ChatArea.tsx', code);
