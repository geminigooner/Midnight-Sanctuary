import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importSearch = "import { GiftsArchive } from './components/GiftsArchive';";
const importReplace = "import { GiftsArchive } from './components/GiftsArchive';\nimport { ProfileModal } from './components/ProfileModal';";
code = code.replace(importSearch, importReplace);

const stateSearch = "  const [giftsOpen, setGiftsOpen] = useState(false);";
const stateReplace = "  const [giftsOpen, setGiftsOpen] = useState(false);\n  const [profileOpen, setProfileOpen] = useState(false);";
code = code.replace(stateSearch, stateReplace);

const renderSearch = "          <GiftsArchive gifts={store.gifts} onClose={() => setGiftsOpen(false)} />\n        )}\n      </AnimatePresence>";
const renderReplace = "          <GiftsArchive gifts={store.gifts} onClose={() => setGiftsOpen(false)} />\n        )}\n      </AnimatePresence>\n\n      <AnimatePresence>\n        {profileOpen && (\n          <ProfileModal profile={store.profile} onClose={() => setProfileOpen(false)} onSave={store.updateProfile} />\n        )}\n      </AnimatePresence>";
code = code.replace(renderSearch, renderReplace);

fs.writeFileSync('src/App.tsx', code);
