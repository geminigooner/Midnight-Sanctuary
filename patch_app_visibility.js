import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          <div className="fixed top-0 left-[-9999px] opacity-0 pointer-events-none">
            <ProfileView profile={store.settings.profile} />
          </div>`;

const replacement = `          <div className="fixed top-0 left-[-9999px] z-0">
            <ProfileView profile={store.settings.profile} />
          </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
