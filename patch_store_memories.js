import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const search = `  const addMemory = useCallback((memoryContent: string, origin?: string) => {`;
const replace = `  const removeMemory = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      memories: (prev.memories || []).filter(m => m.id !== id)
    }));
  }, []);

  const addMemory = useCallback((memoryContent: string, origin?: string) => {`;

code = code.replace(search, replace);

const searchExports = `    addMemory,`;
const replaceExports = `    addMemory,
    removeMemory,`;

code = code.replace(searchExports, replaceExports);

fs.writeFileSync('src/lib/store.ts', code);
