import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// The composer container background
code = code.replace(
  'className={`p-3 sm:p-4 bg-obsidian/90 backdrop-blur-xl border-t border-glass-border z-10 transition-colors duration-500 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${presence === \'listening\' ? \'shadow-[0_-10px_30px_rgba(244,232,211,0.03)]\' : \'\'}`}',
  'className={`p-3 sm:p-4 bg-[#151234] border-t-[3px] border-[#2C194D] z-10 transition-colors duration-500 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}'
);

// The composer inner wrapper
code = code.replace(
  'className={`flex flex-col gap-2 bg-glass border rounded-2xl p-2 transition-colors duration-300 ${presence === \'listening\' ? \'border-champagne/20 bg-white/5\' : \'border-glass-border focus-within:border-copper/40\'}`}',
  'className={`flex flex-col gap-2 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-3xl p-2 transition-all duration-300 focus-within:shadow-[4px_4px_0_#2C194D]`}'
);

// The input
code = code.replace(
  'className="flex-1 bg-transparent max-h-48 min-h-[44px] min-w-0 p-2 resize-none outline-none text-pearlescent placeholder-mauve/40 custom-scrollbar text-base"',
  'className="flex-1 bg-transparent max-h-48 min-h-[44px] min-w-0 px-3 py-2 resize-none outline-none text-[#2C194D] font-bold placeholder-[#2C194D]/40 custom-scrollbar text-base"'
);

// The buttons
code = code.replace(
  'className="p-3 text-mauve/50 hover:text-mauve hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0"',
  'className="p-3 text-[#2C194D]/50 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D]"'
);
code = code.replace(
  'className="p-3 text-mauve/50 hover:text-champagne hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0"',
  'className="p-3 text-[#2C194D]/50 hover:text-[#2C194D] hover:bg-[#F198B7] rounded-xl transition-colors mb-0.5 shrink-0 font-bold border-[2px] border-transparent hover:border-[#2C194D]"'
);
code = code.replace(
  'className="hidden sm:block p-3 text-mauve hover:text-champagne hover:bg-white/10 rounded-xl transition-colors"',
  'className="hidden sm:block p-3 text-[#2C194D]/80 hover:text-[#2C194D] hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl transition-colors font-bold"'
);

// Send button
code = code.replace(
  'className="p-3 text-copper hover:text-champagne hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-colors shrink-0"',
  'className="p-3 text-[#2C194D] hover:bg-[#B39DE5] border-[2px] border-transparent hover:border-[#2C194D] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent rounded-xl transition-colors shrink-0 font-bold"'
);

// Stop generation button
code = code.replace(
  'className="p-3 text-red-400 hover:bg-white/10 rounded-xl transition-colors mb-0.5 shrink-0"',
  'className="p-3 text-red-500 hover:bg-red-500/20 border-[2px] border-transparent hover:border-red-500 rounded-xl transition-colors mb-0.5 shrink-0 font-bold"'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched Composer wrapper inside ChatArea.tsx");
