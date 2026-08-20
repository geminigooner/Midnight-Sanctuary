import fs from 'fs';
let code = fs.readFileSync('src/components/ProfileView.tsx', 'utf8');

code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');

fs.writeFileSync('src/components/ProfileView.tsx', code);
