import fs from 'fs';
let code = fs.readFileSync('src/components/Presence.tsx', 'utf8');

code = code.replace(/bg-mauve/g, 'bg-[#B39DE5]');
code = code.replace(/bg-champagne/g, 'bg-[#F5E1C8]');
code = code.replace(/bg-pearlescent/g, 'bg-[#F5E1C8]');
code = code.replace(/bg-copper/g, 'bg-[#F198B7]');
code = code.replace(/text-copper/g, 'text-[#F198B7]');
code = code.replace(/border-copper/g, 'border-[#F198B7]');
code = code.replace(/border-mauve/g, 'border-[#B39DE5]');
code = code.replace(/bg-ink/g, 'bg-[#151234]');
code = code.replace(/border-glass-border/g, 'border-[#2C194D]');
code = code.replace(/rgba\(158,123,143/g, 'rgba(179,157,229');
code = code.replace(/rgba\(244,232,211/g, 'rgba(245,225,200');
code = code.replace(/rgba\(230,232,230/g, 'rgba(245,225,200');
code = code.replace(/rgba\(196,118,83/g, 'rgba(241,152,183');

fs.writeFileSync('src/components/Presence.tsx', code);
console.log("Patched Presence.tsx");
