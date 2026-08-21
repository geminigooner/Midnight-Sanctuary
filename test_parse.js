let rawTextAccumulator = "Hello <think>Thinking...</think> World <think>More thinking...</think> End";
let apiThoughtAccumulator = "";
let parsedThought = apiThoughtAccumulator;
let parsedText = rawTextAccumulator;

const thinkStartIndex = rawTextAccumulator.indexOf('<think>');
if (thinkStartIndex !== -1) {
    const thinkEndIndex = rawTextAccumulator.indexOf('</think>', thinkStartIndex);
    if (thinkEndIndex !== -1) {
        parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7, thinkEndIndex);
        parsedText = rawTextAccumulator.substring(0, thinkStartIndex) + rawTextAccumulator.substring(thinkEndIndex + 8);
    } else {
        parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7);
        parsedText = rawTextAccumulator.substring(0, thinkStartIndex);
    }
}
console.log("TEXT:", parsedText);
console.log("THOUGHT:", parsedThought);
