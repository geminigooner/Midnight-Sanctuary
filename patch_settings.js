import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

// Also fix in Settings.tsx, sortedModels should strictly be an array
code = code.replace(
  'const sortedModels = useMemo(() => {',
  'const sortedModels = useMemo(() => {\n    if (!Array.isArray(availableModels)) return [];'
);

fs.writeFileSync('src/components/Settings.tsx', code);
