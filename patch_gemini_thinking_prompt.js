import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const target = `  const isGemma = settings.model.includes('gemma');`;

const replacement = `  const isGemma = settings.model.includes('gemma');
  
  if (isGemma) {
      identityParts.push(\`## THINKING DIRECTIVE\\nYou are capable of advanced reasoning. However, do NOT overuse the <think> tag. Only use <think> blocks when you truly need to solve a complex logical problem, interpret something difficult, or process dense math/code. For general conversation, emotional responses, or straightforward answers, respond directly without thinking tags to save output tokens.\`);
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/gemini.ts', code);
console.log("Patched prompt");
