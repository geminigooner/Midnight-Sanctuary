const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldCheck = `thoughtStatus: settings.model.includes('gemma') ? 'thinking' : 'complete',`;
const newCheck = `thoughtStatus: settings.model.includes('gemma') || settings.model.includes('gemini-3') ? 'thinking' : 'complete',`;
code = code.replace(oldCheck, newCheck); // Note: it only replaced the first one before. Let's do it globally.

// Actually I'll just use regex
code = code.replace(/thoughtStatus: settings\.model\.includes\('gemma'\) \? 'thinking' : 'complete'/g, newCheck);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea.tsx thought status 2");
