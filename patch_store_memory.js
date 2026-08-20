import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
  "const addMemory = useCallback((memoryContent: string, origin?: string) => {",
  "const addMemory = useCallback((memoryContent: string, origin?: string, author?: 'user'|'model', modelId?: string, caption?: string) => {"
);

code = code.replace(
  "        id: uuidv4(),\n        content: memoryContent,\n        createdAt: Date.now(),\n        origin\n      };",
  "        id: uuidv4(),\n        content: memoryContent,\n        createdAt: Date.now(),\n        origin,\n        author,\n        modelId,\n        caption\n      };"
);

fs.writeFileSync('src/lib/store.ts', code);
