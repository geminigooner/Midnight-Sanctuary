import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "onAddMemory: (content: string, origin?: string) => void;",
  "onAddMemory: (content: string, origin?: string, author?: 'user'|'model', modelId?: string, caption?: string) => void;"
);

code = code.replace(
  "onAddMemory(chunk.content, 'gemma_initiated');",
  "onAddMemory(chunk.content, 'gemma_initiated', chunk.author, chunk.modelId, chunk.caption);"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
