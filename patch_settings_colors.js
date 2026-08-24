import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

code = code.replace(/className="bg-ink border border-glass-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-\[90dvh\]"/g, 'className="bg-[#151234] border-[3px] border-[#2C194D] rounded-3xl w-full max-w-lg shadow-[8px_8px_0_#2C194D] flex flex-col max-h-[90dvh]"');
code = code.replace(/border-b border-glass-border/g, 'border-b-[3px] border-[#2C194D]');
code = code.replace(/text-champagne border-b-2 border-copper/g, 'text-[#F5E1C8] font-bold border-b-[3px] border-[#F198B7]');
code = code.replace(/hover:bg-glass/g, 'hover:bg-[#F198B7]');
code = code.replace(/text-mauve text-sm py-2/g, 'text-[#B39DE5] font-bold text-sm py-2');
code = code.replace(/w-full bg-black\/40 border border-glass-border rounded-lg p-3 focus:outline-none focus:border-copper\/50 transition-colors/g, 'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] transition-all');
code = code.replace(/text-copper/g, 'text-[#F198B7]');
code = code.replace(/accent-copper/g, 'accent-[#F198B7]');
code = code.replace(/hover:text-copper/g, 'hover:text-[#F198B7]');
code = code.replace(/text-\[\#F5E1C8\] font-bold hover:text-\[\#F198B7\]/g, 'text-[#F5E1C8] font-bold hover:text-[#B39DE5]');
fs.writeFileSync('src/components/Settings.tsx', code);
console.log("Patched Settings.tsx");
