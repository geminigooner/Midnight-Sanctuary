import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  'className={`prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-glass-border prose-pre:overflow-x-auto min-w-0 max-w-none break-words [overflow-wrap:anywhere]',
  'className={`prose prose-p:leading-relaxed prose-pre:bg-[#151234] prose-pre:text-[#F5E1C8] prose-pre:border-[3px] prose-pre:border-[#2C194D] prose-pre:rounded-xl prose-pre:overflow-x-auto min-w-0 max-w-none break-words [overflow-wrap:anywhere] text-[#2C194D] prose-headings:text-[#2C194D] prose-strong:text-[#2C194D] prose-a:text-[#F198B7] prose-code:text-[#F198B7]'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched Prose styling.");
