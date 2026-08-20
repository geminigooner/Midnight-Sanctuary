import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "onAddMemory(chunk.content, 'gemma_initiated', chunk.author, chunk.modelId, chunk.caption);",
  "onAddMemory(chunk.content, 'gemma_initiated', (chunk as any).author, (chunk as any).modelId, (chunk as any).caption);"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
