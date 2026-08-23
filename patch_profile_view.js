import fs from 'fs';
let code = fs.readFileSync('src/components/ProfileView.tsx', 'utf8');

// Replace bg-ink, bg-glass, text-pearlescent, text-mauve, text-copper, etc.
code = code.replace(/bg-ink/g, 'bg-[#151234]');
code = code.replace(/border-copper\/30/g, 'border-[#2C194D]');
code = code.replace(/text-pearlescent/g, 'text-[#2C194D]');
code = code.replace(/text-copper/g, 'text-[#F198B7]');
code = code.replace(/text-mauve/g, 'text-[#B39DE5]');
code = code.replace(/bg-glass/g, 'bg-[#F5E1C8]');
code = code.replace(/border-glass-border/g, 'border-[#2C194D]');
code = code.replace(/bg-black\/20/g, 'bg-[#F5E1C8]');
code = code.replace(/border-2/g, 'border-[3px]');
code = code.replace(/rounded-3xl/g, 'rounded-3xl shadow-[8px_8px_0_#2C194D]');
code = code.replace(/text-\[\#2C194D\]\/90/g, 'text-[#2C194D] font-bold'); // Fix up pearlescent/90
code = code.replace(/text-sm leading-relaxed text-\[\#2C194D\]\/90/g, 'text-sm font-bold leading-relaxed text-[#2C194D]'); // Fix up about section

fs.writeFileSync('src/components/ProfileView.tsx', code);
console.log("Patched ProfileView.tsx");
