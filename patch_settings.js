import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

// Title Headers
code = code.replace(/text-sm text-mauve uppercase tracking-wider font-semibold/g, 'text-sm text-[#F5E1C8] uppercase tracking-wider font-bold');
code = code.replace(/text-sm text-champagne/g, 'text-sm text-[#F5E1C8] font-bold');
code = code.replace(/text-xs text-mauve\/70/g, 'text-xs text-[#B39DE5] font-bold');
code = code.replace(/text-pearlescent/g, 'text-[#2C194D]');
code = code.replace(/text-mauve\/50/g, 'text-[#2C194D]/40');

// Textareas and Inputs
code = code.replace(
  /w-full bg-black\/40 border border-glass-border rounded-lg p-3 focus:outline-none focus:border-copper\/50 transition-colors resize-none text-base text-pearlescent placeholder:text-mauve\/50/g,
  'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all resize-none text-base text-[#2C194D] font-bold placeholder-[#2C194D]/40'
);
code = code.replace(
  /w-full bg-black\/40 border border-glass-border rounded-lg p-3 focus:outline-none focus:border-copper\/50 transition-colors resize-none text-base/g,
  'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all resize-none text-base text-[#2C194D] font-bold'
);
code = code.replace(
  /flex-1 bg-black\/40 border border-glass-border rounded-lg px-3 py-2 focus:outline-none focus:border-copper\/50 transition-colors text-sm text-pearlescent placeholder:text-mauve\/50/g,
  'flex-1 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl px-3 py-2 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all text-sm font-bold text-[#2C194D] placeholder-[#2C194D]/40'
);
code = code.replace(
  /flex-1 bg-black\/20 border border-transparent hover:border-glass-border focus:border-copper\/50 rounded-lg px-3 py-2 focus:outline-none transition-colors text-sm text-pearlescent resize-none/g,
  'flex-1 bg-[#F5E1C8] border-[3px] border-transparent hover:border-[#2C194D] focus:border-[#2C194D] rounded-2xl px-3 py-2 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all text-sm font-bold text-[#2C194D] resize-none'
);

// Buttons
code = code.replace(
  /bg-glass hover:bg-glass-border rounded-lg transition-colors text-champagne/g,
  'bg-[#F198B7] hover:bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all text-[#2C194D]'
);
code = code.replace(
  /p-2 mt-1 text-mauve hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-glass shrink-0/g,
  'p-2 mt-1 text-[#2C194D] hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-[#F198B7] shrink-0 border-[2px] border-transparent hover:border-[#2C194D]'
);

code = code.replace(
  /bg-copper text-obsidian/g,
  'bg-[#F198B7] text-[#2C194D] border-[3px] border-[#2C194D] font-bold shadow-[2px_2px_0_#2C194D]'
);
code = code.replace(
  /bg-glass text-mauve/g,
  'bg-[#151234] text-[#B39DE5] border-[3px] border-[#2C194D] font-bold'
);

code = code.replace(
  /border-t border-glass-border/g,
  'border-t-[3px] border-[#2C194D]'
);

fs.writeFileSync('src/components/Settings.tsx', code);
console.log("Patched Settings.tsx");
