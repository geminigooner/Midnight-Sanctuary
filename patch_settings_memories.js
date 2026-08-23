import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

// memory input
code = code.replace(
  /className="flex-1 bg-black\/40 border border-glass-border rounded-lg px-3 py-2 focus:outline-none focus:border-copper\/50 transition-colors text-sm text-\[#2C194D\] placeholder:text-\[#2C194D\]\/40"/g,
  'className="flex-1 bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl px-3 py-2 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all text-sm font-bold text-[#2C194D] placeholder:text-[#2C194D]/40"'
);

// empty memories text
code = code.replace(
  /className="text-sm text-mauve\/70 italic text-center py-4"/g,
  'className="text-sm text-[#B39DE5] font-bold text-center py-4"'
);

// memory textarea
code = code.replace(
  /className="flex-1 bg-black\/20 border border-transparent hover:border-glass-border focus:border-copper\/50 rounded-lg px-3 py-2 focus:outline-none transition-colors text-sm text-\[#2C194D\] resize-none"/g,
  'className="flex-1 bg-[#F5E1C8] border-[3px] border-transparent hover:border-[#2C194D] focus:border-[#2C194D] focus:shadow-[4px_4px_0_#2C194D] rounded-xl px-3 py-2 focus:outline-none transition-all text-sm font-bold text-[#2C194D] resize-none"'
);

fs.writeFileSync('src/components/Settings.tsx', code);
console.log("Patched Settings.tsx");
