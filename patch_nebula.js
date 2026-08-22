import fs from 'fs';
let code = fs.readFileSync('src/components/NebulaArchive.tsx', 'utf8');

// Title Tooltip
code = code.replace(
  'className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/80 backdrop-blur border border-glass-border rounded-lg px-2 py-1 text-xs whitespace-nowrap text-pearlescent pointer-events-none z-30 shadow-xl"',
  'className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F5E1C8] border-[2px] border-[#2C194D] rounded-xl px-3 py-1.5 text-xs whitespace-nowrap text-[#2C194D] font-bold pointer-events-none z-30 shadow-[4px_4px_0_#2C194D]"'
);

code = code.replace(
  'className="text-[10px] text-mauve/70 mt-0.5"',
  'className="text-[10px] text-[#2C194D]/60 mt-0.5 font-bold"'
);

// Variables for colors
code = code.replace(
  /var\(--color-copper\)/g,
  '#F198B7'
);
code = code.replace(
  /var\(--color-champagne\)/g,
  '#F5E1C8'
);
code = code.replace(
  /var\(--color-mauve\)/g,
  '#B39DE5'
);
code = code.replace(
  /border border-champagne/g,
  'border-[2px] border-[#2C194D]'
);

fs.writeFileSync('src/components/NebulaArchive.tsx', code);
console.log("Patched NebulaArchive.tsx");
