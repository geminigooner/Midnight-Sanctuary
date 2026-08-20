import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const importSearch = "import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User } from 'lucide-react';";
const importReplace = "import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User, Bookmark } from 'lucide-react';";
code = code.replace(importSearch, importReplace);

const propsSearch = "  onOpenProfile: () => void;";
const propsReplace = "  onOpenProfile: () => void;\n  onOpenMemories: () => void;";
code = code.replace(propsSearch, propsReplace);

const destructSearch = "onOpenProfile, availableModels, onAddGift";
const destructReplace = "onOpenProfile, onOpenMemories, availableModels, onAddGift";
code = code.replace(destructSearch, destructReplace);

const desktopIconSearch = `          <button onClick={onOpenProfile} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Profile"><User size={18} /></button>`;
const desktopIconReplace = `          <button onClick={onOpenMemories} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Memories"><Bookmark size={18} /></button>
          <button onClick={onOpenProfile} className="p-2 shrink-0 hover:bg-glass rounded-lg text-mauve transition-colors" title="Profile"><User size={18} /></button>`;
code = code.replace(desktopIconSearch, desktopIconReplace);

const mobileIconSearch = `                <button onClick={() => { setShowMobileMenu(false); onOpenProfile(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <User size={18} /> <span className="flex-1">Profile</span>
                </button>`;
const mobileIconReplace = `                <button onClick={() => { setShowMobileMenu(false); onOpenMemories(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <Bookmark size={18} /> <span className="flex-1">Memories</span>
                </button>
                <button onClick={() => { setShowMobileMenu(false); onOpenProfile(); }} className="flex items-center gap-3 p-3 hover:bg-glass rounded-lg text-mauve transition-colors w-full text-left">
                  <User size={18} /> <span className="flex-1">Profile</span>
                </button>`;
code = code.replace(mobileIconSearch, mobileIconReplace);

fs.writeFileSync('src/components/ChatArea.tsx', code);
