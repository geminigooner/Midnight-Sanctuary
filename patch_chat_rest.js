import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// DEBUG button
code = code.replace(
  'className="text-xs text-copper border border-copper/40 rounded-lg px-3 py-1.5 transition-colors hover:bg-copper/10"',
  'className="text-xs font-bold text-[#2C194D] bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl px-4 py-2 shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all"'
);

// Leave a Gift Container
code = code.replace(
  'className="bg-ink border border-glass-border rounded-2xl w-full max-w-md shadow-2xl p-6"',
  'className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-md p-6"'
);

// Leave a Gift Headers
code = code.replace(
  'className="text-xl font-medium text-pearlescent mb-2"',
  'className="text-2xl font-bold text-[#F5E1C8] mb-1"'
);
code = code.replace(
  'className="text-sm text-mauve mb-4"',
  'className="text-sm font-bold text-[#B39DE5] mb-4"'
);

// Leave a Gift Textarea
code = code.replace(
  'className="w-full bg-glass border border-glass-border rounded-xl p-3 text-pearlescent text-sm resize-none h-32 focus:outline-none focus:border-copper/40 custom-scrollbar mb-4"',
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 text-[#2C194D] font-bold text-sm resize-none h-32 focus:outline-none focus:shadow-[4px_4px_0_#2C194D] custom-scrollbar mb-4 placeholder-[#2C194D]/40 transition-all"'
);

// Leave a Gift Attached Image Wrapper
code = code.replace(
  'className="w-full h-32 object-cover rounded-xl border border-glass-border"',
  'className="w-full h-32 object-cover rounded-2xl border-[3px] border-[#2C194D] shadow-[4px_4px_0_#2C194D]"'
);
code = code.replace(
  'className="absolute top-2 right-2 bg-obsidian rounded-full p-1 border border-glass-border hover:text-red-400 transition-colors"',
  'className="absolute top-2 right-2 bg-[#F198B7] text-[#2C194D] rounded-full p-1 border-[3px] border-[#2C194D] hover:bg-red-500 hover:text-white transition-all"'
);

// Attach Image Button
code = code.replace(
  'className="flex items-center gap-2 px-3 py-2 text-sm text-mauve/70 hover:text-mauve hover:bg-white/10 rounded-lg transition-colors"',
  'className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#2C194D] bg-[#B39DE5] border-[3px] border-[#2C194D] rounded-xl shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 hover:bg-[#F198B7] transition-all"'
);

// Cancel Button
code = code.replace(
  'className="px-4 py-2 rounded-lg text-mauve hover:text-pearlescent transition-colors text-sm"',
  'className="px-4 py-2 rounded-xl text-[#F198B7] border-[3px] border-[#2C194D] bg-[#151234] hover:bg-[#F198B7] hover:text-[#2C194D] transition-all text-sm font-bold"'
);

// Send Button
code = code.replace(
  'className="px-4 py-2 rounded-lg bg-copper text-obsidian hover:bg-champagne transition-colors text-sm disabled:opacity-50 font-medium"',
  'className="px-6 py-2 rounded-xl bg-[#F198B7] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] text-[#2C194D] hover:bg-[#B39DE5] transition-all text-sm disabled:opacity-50 disabled:shadow-none active:shadow-none active:translate-y-0.5 font-bold"'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched rest of ChatArea.tsx");
