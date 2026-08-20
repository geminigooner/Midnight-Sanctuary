import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "onOpenGifts={() => setGiftsOpen(true)}",
  "onOpenGifts={() => setGiftsOpen(true)}\n        onOpenProfile={() => setProfileOpen(true)}"
);

fs.writeFileSync('src/App.tsx', code);
