const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const targetDestructuring = `  const { messages, systemInstruction, temperature, topP, maxOutputTokens, model, forceCloudflare } = reqBody;`;
const replacementDestructuring = `  const { messages, systemInstruction, temperature, topP, maxOutputTokens, model, forceCloudflare, thinkingLevel, includeThoughts } = reqBody;`;

code = code.replace(targetDestructuring, replacementDestructuring);

const targetVars = `          const userThinkingLevel = settings?.thinkingLevel || 'HIGH';
          const userIncludeThoughts = settings?.includeThoughts ?? true;`;
const replacementVars = `          const userThinkingLevel = thinkingLevel || 'HIGH';
          const userIncludeThoughts = includeThoughts ?? true;`;

code = code.replace(targetVars, replacementVars);

// Also need to fix the line: thinkingLevel: settings?.thinkingLevel ? ThinkingLevel[settings.thinkingLevel as keyof typeof ThinkingLevel] || defaultLevel : defaultLevel,
const targetFlash = `              thinkingLevel: settings?.thinkingLevel ? ThinkingLevel[settings.thinkingLevel as keyof typeof ThinkingLevel] || defaultLevel : defaultLevel,`;
const replacementFlash = `              thinkingLevel: thinkingLevel ? ThinkingLevel[thinkingLevel as keyof typeof ThinkingLevel] || defaultLevel : defaultLevel,`;

code = code.replace(targetFlash, replacementFlash);

fs.writeFileSync('src/backend/chatHandler.ts', code);
console.log("Patched chatHandler.ts");
