import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  'className={`${isUser ? \'max-w-[88%] lg:max-w-[75%]\' : \'max-w-[100%] lg:max-w-[90%]\'} p-3 sm:p-4 rounded-3xl relative transition-all duration-300 select-text min-w-0 ${isUser ? userClasses : gemmaClasses}`}',
  'className={`${isUser ? \'max-w-[85%] lg:max-w-[70%]\' : \'max-w-[85%] lg:max-w-[75%]\'} p-3 sm:p-4 rounded-3xl relative transition-all duration-300 select-text min-w-0 ${isUser ? userClasses : gemmaClasses}`}'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched bubble width in ChatArea.tsx");
