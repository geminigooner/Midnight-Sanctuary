import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Replace user bubble classes
code = code.replace(
  'const userClasses = "bg-obsidian/90 backdrop-blur-2xl border border-copper/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] text-champagne";',
  'const userClasses = "bg-[#B39DE5] border-[3px] border-[#2C194D] text-[#2C194D] font-bold shadow-[4px_4px_0_#2C194D]";'
);

// Replace model bubble classes
code = code.replace(
  'const gemmaClasses = "bg-plum/30 backdrop-blur-xl border border-glass-border border-t-white/10 shadow-[0_4px_20px_rgba(244,232,211,0.03)] text-pearlescent";',
  'const gemmaClasses = "bg-[#F5E1C8] border-[3px] border-[#2C194D] text-[#2C194D] font-bold shadow-[4px_4px_0_#2C194D]";'
);

// Remove the inline style boxShadow for settled state
const shadowRegex = /style=\{\{\s*boxShadow:\s*settled\s*\?\s*\([^)]*\)\s*:\s*undefined\s*\}\}/;
code = code.replace(shadowRegex, '');

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched MessageBubble styling.");
