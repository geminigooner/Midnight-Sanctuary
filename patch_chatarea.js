import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// The error is `E.find(e=>e.name===e.model)` which is minified from `availableModels?.find(m => m.name === settings.model)`
// If availableModels is not an array, this throws.
// Let's ensure it defaults to an empty array.
code = code.replace(
  '{availableModels?.find(m => m.name === settings.model)?.displayName || settings.model?.split(\'/\').pop() || \'Unknown Model\'}',
  '{(Array.isArray(availableModels) ? availableModels : [])?.find(m => m.name === settings.model)?.displayName || settings.model?.split(\'/\').pop() || \'Unknown Model\'}'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
