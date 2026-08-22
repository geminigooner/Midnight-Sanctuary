import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Fullscreen image viewer
code = code.replace(
  'className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl cursor-pointer"',
  'className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#151234]/95 backdrop-blur-md cursor-pointer"'
);

code = code.replace(
  'className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm"',
  'className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched Fullscreen image viewer inside ChatArea.tsx");
