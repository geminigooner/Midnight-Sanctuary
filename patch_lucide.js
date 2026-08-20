import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User, Bookmark } from 'lucide-react';",
  "import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User, Bookmark, Smile } from 'lucide-react';"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
