import fs from 'fs';
let code = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');

// Container
code = code.replace(
  /className="bg-ink border border-glass-border rounded-2xl w-full max-w-2xl max-h-\[90vh\] shadow-2xl flex flex-col relative overflow-hidden"/g,
  'className="bg-[#151234] border-[3px] border-[#2C194D] rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-[8px_8px_0_#2C194D] flex flex-col relative overflow-hidden"'
);

// Close button
code = code.replace(
  /className="p-2 text-mauve hover:text-red-400 hover:bg-white\/5 rounded-xl transition-colors"/g,
  'className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all"'
);

// Headers / Sections
code = code.replace(
  /text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2/g,
  'text-xs uppercase tracking-widest text-[#F198B7] font-bold flex items-center gap-2'
);
code = code.replace(
  /text-xs uppercase tracking-widest text-copper font-medium mb-3/g,
  'text-xs uppercase tracking-widest text-[#F198B7] font-bold mb-3'
);
code = code.replace(
  /text-xs text-mauve mb-4/g,
  'text-xs text-[#B39DE5] font-bold mb-4'
);

// Photo Container
code = code.replace(
  /className="w-28 h-28 rounded-full bg-glass border-2 border-glass-border overflow-hidden flex items-center justify-center relative shadow-lg"/g,
  'className="w-28 h-28 rounded-full bg-[#B39DE5] border-[3px] border-[#2C194D] overflow-hidden flex items-center justify-center relative shadow-[4px_4px_0_#2C194D]"'
);
code = code.replace(
  /<User size=\{40\} className="text-mauve\/50" \/>/g,
  '<User size={40} className="text-[#2C194D]" strokeWidth={2.5} />'
);

// Photo actions
code = code.replace(
  /text-copper hover:text-champagne transition-colors/g,
  'text-[#F198B7] hover:text-[#B39DE5] font-bold transition-colors'
);
code = code.replace(
  /text-mauve\/30/g,
  'text-[#2C194D]/30'
);
code = code.replace(
  /text-mauve hover:text-red-400 transition-colors/g,
  'text-[#B39DE5] hover:text-red-500 font-bold transition-colors'
);

// Inputs
code = code.replace(
  /className="w-full bg-black\/40 border border-copper\/30 rounded-xl p-3 text-base outline-none text-champagne"/g,
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-base font-bold outline-none text-[#2C194D] focus:shadow-[4px_4px_0_#2C194D] placeholder-[#2C194D]/40 transition-all"'
);
code = code.replace(
  /className="w-full bg-black\/40 border border-glass-border focus:border-copper\/40 rounded-xl p-3 text-sm outline-none text-pearlescent transition-colors"/g,
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold outline-none text-[#2C194D] focus:shadow-[4px_4px_0_#2C194D] placeholder-[#2C194D]/40 transition-all"'
);
code = code.replace(
  /className="w-full bg-black\/40 border border-glass-border focus:border-copper\/40 rounded-xl p-3 pl-9 text-sm outline-none text-pearlescent transition-colors"/g,
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 pl-9 text-sm font-bold outline-none text-[#2C194D] focus:shadow-[4px_4px_0_#2C194D] placeholder-[#2C194D]/40 transition-all"'
);
code = code.replace(
  /className="w-full bg-black\/40 border border-glass-border focus:border-copper\/40 rounded-xl p-3 text-sm outline-none resize-none text-pearlescent transition-colors"/g,
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold outline-none resize-none text-[#2C194D] focus:shadow-[4px_4px_0_#2C194D] placeholder-[#2C194D]/40 custom-scrollbar transition-all"'
);

// Icons inside inputs
code = code.replace(
  /text-mauve\/50/g,
  'text-[#2C194D]/50'
);

// Memory notes
code = code.replace(
  /className="pt-6 border-t border-glass-border"/g,
  'className="pt-6 border-t-[3px] border-[#2C194D]"'
);
code = code.replace(
  /className="bg-glass border border-glass-border rounded-lg p-3"/g,
  'className="bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 shadow-[2px_2px_0_#2C194D]"'
);
code = code.replace(
  /className="text-sm text-pearlescent"/g,
  'className="text-sm font-bold text-[#2C194D]"'
);

// Footer
code = code.replace(
  /className="p-6 border-t border-glass-border bg-ink\/50 backdrop-blur-md shrink-0 flex justify-end gap-3 z-10"/g,
  'className="p-6 border-t-[3px] border-[#2C194D] bg-[#151234] shrink-0 flex justify-end gap-3 z-10"'
);
code = code.replace(
  /className="px-5 py-2.5 rounded-xl text-mauve hover:bg-white\/5 transition-colors font-medium"/g,
  'className="px-5 py-2.5 rounded-xl font-bold text-[#B39DE5] border-[3px] border-transparent hover:border-[#2C194D] hover:bg-[#F198B7] hover:text-[#2C194D] transition-all"'
);
code = code.replace(
  /className="px-5 py-2.5 bg-copper text-obsidian rounded-xl hover:opacity-90 transition-opacity font-medium shadow-\[0_0_15px_rgba\(196,118,83,0.3\)\]"/g,
  'className="px-5 py-2.5 bg-[#F198B7] text-[#2C194D] border-[3px] border-[#2C194D] rounded-xl hover:bg-[#B39DE5] shadow-[4px_4px_0_#2C194D] active:translate-y-1 active:shadow-none font-bold transition-all"'
);

fs.writeFileSync('src/components/ProfileModal.tsx', code);
console.log("Patched ProfileModal.tsx");
