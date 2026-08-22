import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Model selector dropdown menu
code = code.replace(
  'className="absolute bottom-full left-0 mb-2 flex items-center gap-1 p-2 bg-ink/90 backdrop-blur-xl border border-glass-border rounded-xl shadow-xl z-50"',
  'className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 p-2 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-2xl shadow-[4px_4px_0_#2C194D] z-50"'
);

// Overflow dropdown menu (top right)
code = code.replace(
  'className="absolute top-full right-0 mt-2 w-48 bg-ink/90 backdrop-blur-xl border border-glass-border rounded-xl shadow-xl z-50 overflow-hidden"',
  'className="absolute top-full right-0 mt-2 w-48 bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-2xl shadow-[4px_4px_0_#2C194D] z-50 overflow-hidden py-1"'
);

// Buttons inside dropdowns
code = code.replace(
  /className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-pearlescent hover:bg-white\/10 transition-colors"/g,
  'className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2C194D] hover:bg-[#F198B7] transition-colors"'
);
code = code.replace(
  /className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-white\/10 transition-colors"/g,
  'className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-[#F198B7] transition-colors"'
);

// Quick mode toasts
code = code.replace(
  'className="absolute top-4 right-4 bg-ink/90 backdrop-blur-md border border-copper/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl"',
  'className="absolute top-4 right-4 bg-[#F5E1C8] border-[3px] border-[#2C194D] px-4 py-2 rounded-2xl flex items-center gap-2 shadow-[4px_4px_0_#2C194D]"'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched Dropdowns inside ChatArea.tsx");
