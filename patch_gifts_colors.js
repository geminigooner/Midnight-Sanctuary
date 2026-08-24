import fs from 'fs';
let code = fs.readFileSync('src/components/GiftsArchive.tsx', 'utf8');

code = code.replace(/p-2 hover:bg-glass rounded-full transition-colors text-\[\#2C194D\] hover:text-\[\#2C194D\]/g, 'p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all');
code = code.replace(/text-mauve opacity-50/g, 'text-[#B39DE5] font-bold');
code = code.replace(/text-mauve opacity-0/g, 'text-[#B39DE5] opacity-0');
code = code.replace(/border-t border-glass-border border-dashed/g, 'border-t-[3px] border-[#2C194D] border-dashed');
code = code.replace(/bg-black\/95/g, 'bg-[#151234]/95');
code = code.replace(/text-mauve hover:text-white transition-colors bg-white\/10 rounded-full/g, 'text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all bg-[#151234]');

fs.writeFileSync('src/components/GiftsArchive.tsx', code);
console.log("Patched GiftsArchive.tsx");
