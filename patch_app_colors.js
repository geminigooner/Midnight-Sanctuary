import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/bg-obsidian text-pearlescent/g, 'bg-[#151234] text-[#2C194D]');
code = code.replace(/bg-black\/60/g, 'bg-[#151234]/90');
code = code.replace(/bg-ink border border-glass-border/g, 'bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D]');
code = code.replace(/hover:bg-glass/g, 'hover:bg-[#F198B7]');
code = code.replace(/text-mauve hover:text-champagne/g, 'text-[#B39DE5] hover:text-[#2C194D]');
code = code.replace(/text-mauve/g, 'text-[#B39DE5] font-bold');
code = code.replace(/bg-glass border border-glass-border rounded-xl hover:bg-white\/10 transition-colors flex items-center gap-3 font-medium/g, 'bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl hover:bg-[#F198B7] transition-all flex items-center gap-3 font-bold text-[#2C194D] shadow-[4px_4px_0_#2C194D] hover:shadow-[2px_2px_0_#2C194D] active:translate-y-1 active:shadow-none');
code = code.replace(/bg-glass border border-glass-border rounded-xl hover:bg-white\/10 transition-colors font-medium/g, 'bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl hover:bg-[#F198B7] transition-all font-bold text-[#2C194D] shadow-[4px_4px_0_#2C194D] hover:shadow-[2px_2px_0_#2C194D] active:translate-y-1 active:shadow-none');

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
