import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// replace instances in ChatArea
code = code.replace(/bg-black\/40 border border-copper\/30/g, 'bg-[#F5E1C8] border-[3px] border-[#2C194D]');
code = code.replace(/text-champagne/g, 'text-[#2C194D] font-bold');
code = code.replace(/text-mauve hover:text-champagne/g, 'text-[#B39DE5] hover:text-[#2C194D]');
code = code.replace(/text-copper font-medium hover:text-champagne/g, 'text-[#F198B7] font-bold hover:text-[#2C194D]');
code = code.replace(/text-copper\/90/g, 'text-[#F198B7]');
code = code.replace(/text-mauve\/50/g, 'text-[#B39DE5]/50');
code = code.replace(/border border-glass-border/g, 'border-[3px] border-[#2C194D]');
code = code.replace(/p-1\.5 bg-glass rounded-lg hover:bg-white\/10/g, 'p-1.5 bg-[#F5E1C8] rounded-xl hover:bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]');
code = code.replace(/text-mauve/g, 'text-[#2C194D]');
code = code.replace(/text-copper/g, 'text-[#F198B7]');
code = code.replace(/bg-ink/g, 'bg-[#151234]');
code = code.replace(/bg-glass/g, 'bg-[#F5E1C8]');
code = code.replace(/border-copper\/30/g, 'border-[#2C194D]');
code = code.replace(/bg-black\/90/g, 'bg-[#151234]');
code = code.replace(/hover:bg-copper hover:text-obsidian/g, 'hover:bg-[#F198B7] hover:text-[#2C194D]');

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea.tsx");
