const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// Insert import if not present
if (!code.includes("import { getContextMemories, isUserMemory } from './memorySystem';")) {
  code = code.replace(
    "import { auth, signOut } from './firebase';",
    "import { auth, signOut } from './firebase';\nimport { getContextMemories, isUserMemory } from './memorySystem';"
  );
}

const oldMemoriesLogic = `  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const relevantMemories = settings.memories.filter(m => {
      const isModelAuthor = m.author === 'model' || m.origin === 'gemma_initiated';
      if (!isModelAuthor) return true; // Include user or legacy memories
      
      // If model memory, only include it if it was created by the current model.
      // If it has no modelId, treat as legacy model memory.
      if (m.modelId) {
        return m.modelId === settings.model;
      }
      return true; // Include legacy model memories, but we will label them clearly
    });

    if (relevantMemories.length > 0) {
      const memoryText = relevantMemories.map(m => {
        const isExplicitUser = m.author === 'user' || m.origin === 'user_favorited' || m.origin === 'user_saved';
        const isExplicitModel = (m.author === 'model' || m.origin === 'gemma_initiated') && m.modelId === settings.model;
        
        let prefix = '[Legacy/Unassigned Memory]';
        if (isExplicitUser) {
           prefix = '[User Saved]';
        } else if (isExplicitModel) {
           prefix = '[My Memory]';
        }
        
        return \`- \${prefix} \${m.content}\`;
      }).join('\\n');
      identityParts.push(\`## Context & Saved Memories:\\n\${memoryText}\`);
    }
  }`;

const newMemoriesLogic = `  if (settings.memoriesEnabled && settings.memories && settings.memories.length > 0) {
    const relevantMemories = getContextMemories(settings.memories, settings.model);

    if (relevantMemories.length > 0) {
      const memoryText = relevantMemories.map(m => {
        const prefix = isUserMemory(m) ? '[User Saved]' : '[My Memory]';
        return \`- \${prefix} \${m.content}\`;
      }).join('\\n');
      identityParts.push(\`## Context & Saved Memories:\\n\${memoryText}\`);
    }
  }`;

if (!code.includes("const relevantMemories = getContextMemories")) {
  code = code.replace(oldMemoriesLogic, newMemoriesLogic);
  fs.writeFileSync('src/lib/gemini.ts', code);
  console.log("Patched gemini.ts");
} else {
  console.log("Already patched");
}
