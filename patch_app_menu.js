import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace("import { Menu } from 'lucide-react';", "");
code = code.replace("import { Sidebar } from './components/Sidebar';", "import { Sidebar } from './components/Sidebar';\nimport { Menu } from 'lucide-react';");
fs.writeFileSync('src/App.tsx', code);
