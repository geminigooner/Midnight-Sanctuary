import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// add onOpenProfile to ChatAreaProps
code = code.replace(
  "onOpenGifts: () => void;",
  "onOpenGifts: () => void;\n  onOpenProfile: () => void;"
);

// update ChatArea parameters
code = code.replace(
  "onOpenJewel, onOpenGifts, availableModels",
  "onOpenJewel, onOpenGifts, onOpenProfile, availableModels"
);

// add to desktop actions
const desktopSearch = `          <button onClick={onOpenSettings} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Settings"><SettingsIcon size={18} /></button>`;
const desktopReplace = `          <button onClick={onOpenProfile} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Profile"><User size={18} /></button>\n          <button onClick={onOpenSettings} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Settings"><SettingsIcon size={18} /></button>`;
code = code.replace(desktopSearch, desktopReplace);

// add to mobile actions
const mobileSearch = `                <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <SettingsIcon size={18} /> <span className="flex-1">Settings</span>
                </button>`;
const mobileReplace = `                <button onClick={() => { setShowMobileMenu(false); onOpenProfile(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <User size={18} /> <span className="flex-1">Profile</span>
                </button>\n                <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <SettingsIcon size={18} /> <span className="flex-1">Settings</span>
                </button>`;
code = code.replace(mobileSearch, mobileReplace);

fs.writeFileSync('src/components/ChatArea.tsx', code);
