import fs from 'fs';
let code = fs.readFileSync('src/components/ProfileView.tsx', 'utf8');

code = code.replace(/text-champagne/g, 'text-[#F5E1C8] font-bold');
code = code.replace(/border-ink bg-obsidian/g, 'border-[#2C194D] bg-[#151234] border-[3px]');
code = code.replace(/from-copper\/20 via-plum\/30 to-obsidian/g, 'from-[#B39DE5] via-[#F198B7] to-[#151234]');

fs.writeFileSync('src/components/ProfileView.tsx', code);
console.log("Patched ProfileView.tsx 2");
