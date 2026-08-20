import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { ProfileView }")) {
  code = code.replace("import { ProfileModal } from './components/ProfileModal';", "import { ProfileModal } from './components/ProfileModal';\nimport { ProfileView } from './components/ProfileView';");
  
  const target = `{memoriesOpen && (
          <MemoriesArchive`;
  const replacement = `
        {store.settings.profile && (
          <div className="fixed top-0 left-[-9999px] opacity-0 pointer-events-none">
            <ProfileView profile={store.settings.profile} />
          </div>
        )}
        
        {memoriesOpen && (
          <MemoriesArchive`;
  
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
}
