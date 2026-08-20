import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `    if (isGenerating || isGeneratingRef.current) {
      console.warn("handleSend blocked: Generation already in progress.");`;

const replacement = `    if ((isGenerating || isGeneratingRef.current) && !isResumeToolCall) {
      console.warn("handleSend blocked: Generation already in progress.");`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
