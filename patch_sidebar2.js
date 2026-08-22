import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  'className={`flex flex-col h-full bg-ink/50 backdrop-blur-md border-r border-glass-border w-full relative`}',
  'className={`flex flex-col h-full bg-[#151234] border-r-[3px] border-[#2C194D] w-full relative`}'
);

code = code.replace(
  'className="p-4 border-b border-glass-border flex flex-col gap-3 z-10 shrink-0"',
  'className="p-4 border-b-[3px] border-[#2C194D] flex flex-col gap-3 z-10 shrink-0"'
);

code = code.replace(
  'className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-glass border border-glass-border rounded-xl hover:bg-white/10 transition-colors text-champagne"',
  'className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-[20px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all text-[#2C194D] font-bold text-lg tracking-tight"'
);

code = code.replace(
  'className="flex bg-black/40 border border-glass-border rounded-lg p-1"',
  'className="flex bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]"'
);

code = code.replace(
  /className=\{`flex-1 flex items-center justify-center gap-2 py-1\.5 rounded-md text-xs font-medium transition-colors \$\{viewMode === 'list' \? 'bg-white\/10 text-champagne shadow-sm' : 'text-mauve hover:text-champagne'\}`\}/g,
  'className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === \'list\' ? \'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent\'}`}'
);

code = code.replace(
  /className=\{`flex-1 flex items-center justify-center gap-2 py-1\.5 rounded-md text-xs font-medium transition-colors \$\{viewMode === 'nebula' \? 'bg-white\/10 text-champagne shadow-sm' : 'text-mauve hover:text-champagne'\}`\}/g,
  'className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === \'nebula\' ? \'bg-[#B39DE5] text-[#2C194D] border-[2px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'text-[#2C194D]/60 hover:text-[#2C194D] border-[2px] border-transparent\'}`}'
);

code = code.replace(
  'className="p-3 border-b border-glass-border relative z-10 shrink-0"',
  'className="p-3 border-b-[3px] border-[#2C194D] relative z-10 shrink-0"'
);

code = code.replace(
  'className="absolute left-6 top-1/2 -translate-y-1/2 text-mauve"',
  'className="absolute left-6 top-1/2 -translate-y-1/2 text-[#2C194D]/50" strokeWidth={3}'
);

code = code.replace(
  'className="w-full bg-black/40 border border-glass-border rounded-lg pl-9 pr-4 py-2 text-base focus:outline-none focus:border-copper/50 text-pearlescent placeholder-mauve/50"',
  'className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl pl-10 pr-4 py-2.5 text-base font-bold focus:outline-none focus:shadow-[2px_2px_0_#2C194D] text-[#2C194D] placeholder-[#2C194D]/40 transition-all"'
);

code = code.replace(
  /className=\{`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors \$\{currentId === c\.id \? 'bg-glass border border-glass-border' : 'hover:bg-glass\/50 border border-transparent'\}`\}/g,
  'className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${currentId === c.id ? \'bg-[#F5E1C8] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'hover:bg-[#B39DE5] border-[3px] border-transparent hover:border-[#2C194D] hover:shadow-[2px_2px_0_#2C194D]\'}`}'
);

code = code.replace(
  /className=\{currentId === c\.id \? 'text-copper' : 'text-mauve'\}/g,
  'className="text-[#2C194D] shrink-0" strokeWidth={currentId === c.id ? 2.5 : 2}'
);

code = code.replace(
  /className="truncate text-sm opacity-90"/g,
  'className="truncate text-sm font-bold text-[#2C194D]"'
);

code = code.replace(
  /className="bg-black\/60 border border-copper\/50 rounded px-2 py-1 text-base w-full outline-none text-champagne"/g,
  'className="bg-white border-[2px] border-[#2C194D] rounded-xl px-2 py-1 text-base w-full outline-none text-[#2C194D] font-bold"'
);

code = code.replace(
  /className="p-1 hover:text-green-400"/g,
  'className="p-1 hover:text-green-600 text-[#2C194D]"'
);
code = code.replace(
  /className="p-1 hover:text-red-400"/g,
  'className="p-1 hover:text-red-600 text-[#2C194D]"'
);

code = code.replace(
  /className="p-1\.5 hover:bg-white\/10 rounded-md text-mauve hover:text-champagne transition-colors"/g,
  'className="p-1.5 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl text-[#2C194D] transition-all"'
);
code = code.replace(
  /className="p-1\.5 hover:bg-white\/10 rounded-md text-mauve hover:text-red-400 transition-colors"/g,
  'className="p-1.5 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl text-[#2C194D] transition-all"'
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Patched Sidebar.tsx");
