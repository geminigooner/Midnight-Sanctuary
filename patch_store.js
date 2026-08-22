import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const target = `      // If the model changed, clear the currentId so we don't bleed chats
      if (newSettings.model && newSettings.model !== prev.model) {
         setCurrentId(null);
      }`;

code = code.replace(target, `      // Model changing no longer clears the current chat.`);
fs.writeFileSync('src/lib/store.ts', code);
console.log("Patched store.ts");
