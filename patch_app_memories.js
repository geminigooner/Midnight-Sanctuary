import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importSearch = "import { GiftsArchive } from './components/GiftsArchive';";
const importReplace = "import { GiftsArchive } from './components/GiftsArchive';\nimport { MemoriesArchive } from './components/MemoriesArchive';";
code = code.replace(importSearch, importReplace);

const stateSearch = "  const [profileOpen, setProfileOpen] = useState(false);";
const stateReplace = "  const [profileOpen, setProfileOpen] = useState(false);\n  const [memoriesOpen, setMemoriesOpen] = useState(false);";
code = code.replace(stateSearch, stateReplace);

const renderSearch = `        {profileOpen && (
          <ProfileModal profile={store.profile} onClose={() => setProfileOpen(false)} onSave={store.updateProfile} />
        )}
      </AnimatePresence>`;
const renderReplace = `        {profileOpen && (
          <ProfileModal profile={store.profile} onClose={() => setProfileOpen(false)} onSave={store.updateProfile} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {memoriesOpen && (
          <MemoriesArchive memories={store.settings.memories} onClose={() => setMemoriesOpen(false)} onRemoveMemory={store.removeMemory} />
        )}
      </AnimatePresence>`;
code = code.replace(renderSearch, renderReplace);

const chatAreaSearch = `        onOpenProfile={() => setProfileOpen(true)}`;
const chatAreaReplace = `        onOpenProfile={() => setProfileOpen(true)}\n        onOpenMemories={() => setMemoriesOpen(true)}`;
code = code.replace(chatAreaSearch, chatAreaReplace);

fs.writeFileSync('src/App.tsx', code);
