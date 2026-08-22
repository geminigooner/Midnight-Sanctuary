import fs from 'fs';

const files = [
  'src/components/GiftsArchive.tsx',
  'src/components/MemoriesArchive.tsx',
  'src/components/ProfileModal.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Any unpatched modal container
  code = code.replace(
    /className="bg-ink border border-glass-border rounded-2xl w-full [^"]* max-h-\[85vh\] shadow-2xl flex flex-col relative overflow-hidden"/g,
    (match) => match.replace(
      /bg-ink border border-glass-border rounded-2xl w-full ([^ ]+) max-h-\[85vh\] shadow-2xl flex flex-col relative overflow-hidden/,
      'bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full $1 max-h-[85vh] flex flex-col relative overflow-hidden'
    )
  );
  
  // Headers
  code = code.replace(/text-xl font-medium text-pearlescent tracking-wide/g, 'text-2xl font-bold text-[#F5E1C8] tracking-tight');
  code = code.replace(/text-sm text-mauve/g, 'text-sm font-bold text-[#B39DE5]');
  
  // Icons in headers
  code = code.replace(
    /w-10 h-10 rounded-xl bg-glass border border-glass-border flex items-center justify-center text-copper shadow-\[inset_0_1px_2px_rgba\(255,255,255,0\.05\)\]/g,
    'w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D]'
  );
  
  // Cards / List items
  code = code.replace(
    /bg-glass border border-glass-border rounded-xl p-5 hover:border-copper\/40/g,
    'bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-5 hover:shadow-[4px_4px_0_#2C194D]'
  );
  
  // Text inside cards
  code = code.replace(/text-pearlescent prose prose-invert/g, 'text-[#2C194D] prose');
  code = code.replace(/text-xs text-copper\/80 uppercase tracking-widest font-medium/g, 'text-xs text-[#F198B7] uppercase tracking-widest font-bold bg-[#2C194D] px-2 py-1 rounded w-max');

  // Forms / Inputs / Textareas
  code = code.replace(
    /w-full bg-black\/40 border border-glass-border rounded-lg p-3 text-pearlescent focus:outline-none focus:border-copper\/50 resize-none text-sm/g,
    'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 text-[#2C194D] font-bold focus:outline-none focus:shadow-[4px_4px_0_#2C194D] resize-none text-sm placeholder-[#2C194D]/40 transition-all'
  );
  
  code = code.replace(
    /w-full bg-black\/40 border border-glass-border rounded-lg p-3 text-pearlescent focus:outline-none focus:border-copper\/50 resize-none/g,
    'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-3 text-[#2C194D] font-bold focus:outline-none focus:shadow-[4px_4px_0_#2C194D] resize-none placeholder-[#2C194D]/40 transition-all'
  );

  code = code.replace(
    /w-full bg-black\/40 border border-glass-border rounded-lg px-3 py-2 text-pearlescent focus:outline-none focus:border-copper\/50/g,
    'w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl px-3 py-2 text-[#2C194D] font-bold focus:outline-none focus:shadow-[4px_4px_0_#2C194D] placeholder-[#2C194D]/40 transition-all'
  );

  // Labels
  code = code.replace(/text-sm text-mauve uppercase tracking-wider font-semibold/g, 'text-sm text-[#F5E1C8] uppercase tracking-wider font-bold');
  code = code.replace(/text-sm text-champagne font-medium/g, 'text-sm text-[#F5E1C8] font-bold');
  code = code.replace(/text-xs text-mauve\/70/g, 'text-xs text-[#B39DE5] font-bold');

  // Profile Specific - Toggles
  code = code.replace(
    /px-4 py-2 rounded-lg text-sm font-medium transition-colors border \$\{profile\.role === 'Creator' \? 'bg-copper text-obsidian border-copper' : 'bg-glass text-mauve border-transparent hover:border-glass-border'\}/g,
    'px-4 py-2 rounded-xl text-sm font-bold transition-all border-[3px] ${profile.role === \'Creator\' ? \'bg-[#F198B7] text-[#2C194D] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'bg-[#F5E1C8] text-[#2C194D]/60 border-transparent hover:border-[#2C194D]\'}'
  );
  code = code.replace(
    /px-4 py-2 rounded-lg text-sm font-medium transition-colors border \$\{profile\.role === 'Observer' \? 'bg-copper text-obsidian border-copper' : 'bg-glass text-mauve border-transparent hover:border-glass-border'\}/g,
    'px-4 py-2 rounded-xl text-sm font-bold transition-all border-[3px] ${profile.role === \'Observer\' ? \'bg-[#F198B7] text-[#2C194D] border-[#2C194D] shadow-[2px_2px_0_#2C194D]\' : \'bg-[#F5E1C8] text-[#2C194D]/60 border-transparent hover:border-[#2C194D]\'}'
  );
  
  // Profile Add Fact button
  code = code.replace(
    /flex items-center gap-2 text-sm text-copper hover:text-champagne transition-colors/g,
    'flex items-center gap-2 text-sm font-bold text-[#2C194D] bg-[#F198B7] border-[3px] border-[#2C194D] px-3 py-1.5 rounded-xl shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all'
  );

  // Profile Save Button
  code = code.replace(
    /px-6 py-2 bg-copper text-obsidian rounded-lg hover:bg-champagne transition-colors font-medium/g,
    'px-6 py-2 bg-[#F198B7] text-[#2C194D] rounded-xl hover:bg-[#B39DE5] border-[3px] border-[#2C194D] shadow-[2px_2px_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all font-bold'
  );

  // Cancel Button in Footer
  code = code.replace(
    /px-6 py-2 text-mauve hover:text-pearlescent transition-colors/g,
    'px-6 py-2 text-[#F198B7] bg-[#151234] border-[3px] border-[#2C194D] rounded-xl hover:bg-[#F198B7] hover:text-[#2C194D] transition-all font-bold'
  );

  // Delete button on facts
  code = code.replace(
    /p-2 text-mauve hover:text-red-400 hover:bg-glass rounded-lg transition-colors/g,
    'p-2 text-red-500 hover:text-white hover:bg-red-500 border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all'
  );
  
  fs.writeFileSync(file, code);
  console.log(`Patched ${file}`);
}
