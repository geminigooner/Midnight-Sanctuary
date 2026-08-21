import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('const updateWithParsedThinking = (textChunk, force = false) => {'));
const end = lines.findIndex((l, i) => i > start && l.includes('currentModelText = parsedText.trimStart();'));

if (start !== -1 && end !== -1) {
    const replacement = `      const updateWithParsedThinking = (textChunk, force = false) => {
         if (textChunk) rawTextAccumulator += textChunk;
         
         let parsedThought = apiThoughtAccumulator;
         let parsedText = rawTextAccumulator;
         let status = 'complete';
         
         let currentText = rawTextAccumulator;
         let extractedThoughts = [];
         
         while (true) {
             const startIndex = currentText.indexOf('<think>');
             if (startIndex === -1) break;
             
             const endIndex = currentText.indexOf('</think>', startIndex);
             if (endIndex !== -1) {
                 extractedThoughts.push(currentText.substring(startIndex + 7, endIndex));
                 currentText = currentText.substring(0, startIndex) + currentText.substring(endIndex + 8);
             } else {
                 extractedThoughts.push(currentText.substring(startIndex + 7));
                 currentText = currentText.substring(0, startIndex);
                 status = 'thinking';
                 break;
             }
         }
         
         if (extractedThoughts.length > 0) {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\\n' : '') + extractedThoughts.join('\\n\\n');
         }
         parsedText = currentText;
         `;
         
    lines.splice(start, end - start, replacement);
    fs.writeFileSync('src/components/ChatArea.tsx', lines.join('\n'));
    console.log("Patched correctly");
} else {
    console.log("Not found");
}
