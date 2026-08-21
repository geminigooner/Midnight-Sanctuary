let rawTextAccumulator = "Hello <think>Thinking...</think> World <think>More thinking...</think> End\n<think>Unfinished";
let apiThoughtAccumulator = "";
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
    parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\n' : '') + extractedThoughts.join('\n');
}
parsedText = currentText;

console.log("TEXT:", parsedText);
console.log("THOUGHT:", parsedThought);
console.log("STATUS:", status);
