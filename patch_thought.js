import fs from 'fs';
let code = fs.readFileSync('src/components/ThoughtBubble.tsx', 'utf8');

code = code.replace(
  'className="flex flex-col gap-2 mt-1 mb-3"',
  'className="flex flex-col gap-2 mt-2 mb-4 relative"'
);

code = code.replace(
  'className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-max cursor-pointer transition-colors ${isOpen ? \'bg-obsidian/90 text-copper border border-copper/30 shadow-[0_0_10px_rgba(196,118,83,0.1)]\' : \'bg-obsidian/60 text-mauve/70 border border-copper/20 hover:text-copper hover:bg-obsidian/80\'}`}',
  'className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold w-max cursor-pointer transition-all border-[3px] border-[#2C194D] ${isOpen ? \'bg-[#F198B7] text-[#2C194D] shadow-[2px_2px_0_#2C194D] translate-y-0.5\' : \'bg-[#F5E1C8] text-[#2C194D] shadow-[4px_4px_0_#2C194D] hover:shadow-[2px_2px_0_#2C194D] hover:translate-y-0.5 hover:bg-[#F198B7]\'}`}'
);

code = code.replace(
  'className="bg-plum/10 backdrop-blur-md border border-copper/10 rounded-2xl p-4 overflow-hidden relative"',
  'className="bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-3xl p-5 overflow-hidden relative shadow-[4px_4px_0_#2C194D] mt-2"'
);

code = code.replace(
  'className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-copper/50 to-transparent"',
  'className="hidden"'
);

code = code.replace(
  'className="prose prose-invert prose-sm max-w-none text-mauve/90 leading-relaxed font-mono opacity-90"',
  'className="prose prose-sm max-w-none text-[#2C194D] leading-relaxed font-bold opacity-90 prose-p:text-[#2C194D] prose-headings:text-[#2C194D] prose-strong:text-[#2C194D]"'
);

fs.writeFileSync('src/components/ThoughtBubble.tsx', code);
console.log("Patched ThoughtBubble.tsx");
