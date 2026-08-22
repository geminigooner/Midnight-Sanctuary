import fs from 'fs';
let code = fs.readFileSync('src/components/LevinJewel.tsx', 'utf8');

// Container
code = code.replace(
  'className="flex bg-black/40 p-1 rounded-lg border border-glass-border w-full max-w-[300px]"',
  'className="flex bg-[#F5E1C8] p-1 rounded-2xl border-[3px] border-[#2C194D] w-full max-w-[300px] shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]"'
);

// Tab buttons
code = code.replace(
  /className=\{`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all \$\{activeTab === 'jewel' \? 'bg-glass border border-copper\/30 text-champagne shadow-sm' : 'text-mauve\/70 hover:text-mauve'\}`\}/g,
  'className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === \'jewel\' ? \'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent\'}`}'
);
code = code.replace(
  /className=\{`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all \$\{activeTab === 'insights' \? 'bg-glass border border-copper\/30 text-champagne shadow-sm' : 'text-mauve\/70 hover:text-mauve'\}`\}/g,
  'className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === \'insights\' ? \'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent\'}`}'
);

// Jewel wrapper
code = code.replace(
  'className="relative w-48 h-48 flex items-center justify-center bg-obsidian rounded-full shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] border border-glass-border overflow-hidden"',
  'className="relative w-48 h-48 flex items-center justify-center bg-[#151234] rounded-full shadow-[inset_4px_4px_0_#2C194D] border-[3px] border-[#2C194D] overflow-hidden"'
);

// Text below jewel
code = code.replace(
  'className="text-lg font-medium text-champagne capitalize tracking-wide"',
  'className="text-xl font-bold text-[#F5E1C8] capitalize tracking-tight"'
);
code = code.replace(
  'className="text-xs text-mauve/60 max-w-[200px] leading-relaxed"',
  'className="text-xs font-bold text-[#B39DE5] max-w-[200px] leading-relaxed"'
);
code = code.replace(
  'className="text-xs text-mauve/60 max-w-[300px] text-center mt-4"',
  'className="text-xs font-bold text-[#B39DE5] max-w-[300px] text-center mt-4"'
);

// Action buttons (Export / Reset)
code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-pearlescent transition-colors border border-glass-border hover:border-white/20"',
  'className="flex items-center gap-2 px-4 py-2 bg-[#B39DE5] rounded-xl hover:bg-[#F198B7] text-sm text-[#2C194D] transition-all font-bold border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5"'
);
code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-copper transition-colors border border-copper/30 hover:border-copper/60"',
  'className="flex items-center gap-2 px-4 py-2 bg-[#151234] rounded-xl hover:bg-[#F198B7] hover:text-[#2C194D] text-sm text-[#F198B7] transition-all font-bold border-[3px] border-[#2C194D]"'
);

fs.writeFileSync('src/components/LevinJewel.tsx', code);
console.log("Patched LevinJewel.tsx");
