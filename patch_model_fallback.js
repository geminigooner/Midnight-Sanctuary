import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `{(Array.isArray(availableModels) ? availableModels : []).map(m => (
                       <option key={m.name} value={m.name}>{m.displayName}</option>
                     ))}`;
const replacement = `{(Array.isArray(availableModels) ? availableModels : []).map(m => (
                       <option key={m.name} value={m.name}>{m.displayName}</option>
                     ))}
                     {settings.model && !((Array.isArray(availableModels) ? availableModels : []).find(m => m.name === settings.model)) && (
                       <option key={settings.model} value={settings.model}>{settings.model.split('/').pop()}</option>
                     )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched fallback model");
