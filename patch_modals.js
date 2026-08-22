import fs from 'fs';

const files = [
  'src/components/MemoriesArchive.tsx',
  'src/components/ProfileModal.tsx',
  'src/components/Settings.tsx',
  'src/components/GiftsArchive.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Overlay
  code = code.replace(
    'bg-obsidian/80 backdrop-blur-sm',
    'bg-[#151234]/90 backdrop-blur-sm'
  );

  // Modal container
  code = code.replace(
    'bg-obsidian border border-glass-border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative',
    'bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative'
  );

  // Modal header
  code = code.replace(
    'border-b border-glass-border bg-ink/50 backdrop-blur-md',
    'border-b-[3px] border-[#2C194D] bg-[#151234]'
  );

  // Buttons in modals
  code = code.replace(
    /hover:bg-white\/10 transition-colors/g,
    'hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] transition-all'
  );
  
  // Close buttons
  code = code.replace(
    /text-mauve hover:text-champagne/g,
    'text-[#2C194D] hover:text-[#2C194D]'
  );

  fs.writeFileSync(file, code);
  console.log(`Patched ${file}`);
}
