import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

code = code.replace(/p-2 hover:bg-glass rounded-full transition-colors text-\[\#2C194D\] hover:text-\[\#2C194D\]/g, 'p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all');
code = code.replace(/flex border-b border-glass-border/g, 'flex border-b-[3px] border-[#2C194D]');
code = code.replace(/text-copper border-b-2 border-copper bg-white\/5/g, 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]');
code = code.replace(/text-mauve hover:text-pearlescent/g, 'text-[#B39DE5] hover:text-[#F5E1C8] font-bold');
code = code.replace(/text-mauve opacity-50/g, 'text-[#B39DE5] font-bold');
code = code.replace(/text-mauve\/40 hover:text-red-400 transition-colors rounded-full hover:bg-white\/5/g, 'text-[#2C194D]/40 hover:text-red-600 transition-all rounded-xl hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D]');
code = code.replace(/text-copper\/90 font-medium mb-2 opacity-80/g, 'text-[#F198B7] font-bold mb-2');
code = code.replace(/border-t border-glass-border border-dashed/g, 'border-t-[3px] border-[#2C194D] border-dashed');
code = code.replace(/text-\[10px\] text-mauve italic/g, 'text-[10px] text-[#B39DE5] font-bold');

fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
console.log("Patched MemoriesArchive.tsx");
