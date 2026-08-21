import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const targetUnshift = `  if (syntheticTurn) {
    serializedMessages.unshift(syntheticTurn);
  }`;

const replacementAppends = `  if (syntheticTurn) {
    // Instead of unshifting to the beginning, let's append these context parts to the LAST user message,
    // so the model is acutely aware of the gifts right now.
    let lastUserIndex = -1;
    for (let i = serializedMessages.length - 1; i >= 0; i--) {
      if (serializedMessages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex !== -1) {
      serializedMessages[lastUserIndex].parts.unshift(...syntheticTurn.parts);
    } else {
      serializedMessages.push(syntheticTurn);
    }
  }`;

code = code.replace(targetUnshift, replacementAppends);
fs.writeFileSync('src/lib/gemini.ts', code);
console.log("Patched gifts");
