import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const target = `  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const memoryText = settings.memories.map(m => \`- \${m.content}\`).join('\\n');
    identityParts.push(\`## Saved Memories:\\n\${memoryText}\`);
  }`;

const replacement = `  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const relevantMemories = settings.memories.filter(m => {
      const isModelAuthor = m.author === 'model' || m.origin === 'gemma_initiated';
      if (!isModelAuthor) return true; // Always include user-saved memories
      
      // If model memory, only include it if it was created by the current model (or is legacy)
      if (m.modelId) {
        return m.modelId === settings.model;
      }
      return true; // Include legacy model memories
    });

    if (relevantMemories.length > 0) {
      const memoryText = relevantMemories.map(m => {
        const prefix = m.author === 'user' || m.origin === 'user_favorited' ? '[User Saved]' : '[My Memory]';
        return \`- \${prefix} \${m.content}\`;
      }).join('\\n');
      identityParts.push(\`## Context & Saved Memories:\\n\${memoryText}\`);
    }
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/gemini.ts', code);
