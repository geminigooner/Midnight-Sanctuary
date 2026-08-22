import fs from 'fs';
let code = fs.readFileSync('src/components/ThoughtBubble.tsx', 'utf8');

code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-obsidian/60 border border-copper/20 hover:border-copper/40 disabled:opacity-80 disabled:hover:border-copper/20 transition-all shadow-sm group"',
  'className="flex items-center gap-2 px-4 py-2 rounded-full border-[3px] border-[#2C194D] bg-[#F5E1C8] text-[#2C194D] shadow-[2px_2px_0_#2C194D] active:translate-y-0.5 active:shadow-none hover:bg-[#F198B7] disabled:opacity-80 transition-all group"'
);

code = code.replace(
  /className=\{`\$\{status === 'thinking' \? 'animate-pulse text-copper' : 'text-mauve group-hover:text-champagne'\}`\}/g,
  'className={`text-[#2C194D] ${status === \'thinking\' ? \'animate-pulse\' : \'\'}`}'
);

code = code.replace(
  'className="text-xs font-mono tracking-wide text-mauve group-hover:text-champagne transition-colors"',
  'className="text-xs font-bold tracking-wide text-[#2C194D] transition-colors"'
);

code = code.replace(
  /className="w-1 h-1 bg-copper rounded-full"/g,
  'className="w-1 h-1 bg-[#2C194D] rounded-full"'
);

code = code.replace(
  'className="text-mauve ml-1"',
  'className="text-[#2C194D] ml-1" strokeWidth={3}'
);

code = code.replace(
  'className="text-mauve ml-1"',
  'className="text-[#2C194D] ml-1" strokeWidth={3}'
);

code = code.replace(
  'className="mt-2 w-full max-h-[320px] overflow-y-auto p-4 rounded-2xl bg-plum/10 backdrop-blur-md border border-copper/10 text-xs font-mono text-mauve/90 whitespace-pre-wrap leading-relaxed shadow-inner break-words [overflow-wrap:anywhere]"',
  'className="mt-2 w-full max-h-[320px] overflow-y-auto p-4 rounded-3xl bg-[#B39DE5] border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D] text-xs font-bold text-[#2C194D] whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]"'
);

fs.writeFileSync('src/components/ThoughtBubble.tsx', code);
console.log("Patched ThoughtBubble.tsx accurately");
