import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "  onDelete\n}: { \n  msg: Message;\n  isLast: boolean;\n  isGenerating: boolean;\n  onCopy: (t: string) => void;\n  onResend?: (content: string) => void;\n  onFavorite?: (content: string) => void;\n  onImageClick?: (url: string) => void;\n  onDelete?: () => void;\n}) {",
  "  onDelete,\n  onReact\n}: { \n  msg: Message;\n  isLast: boolean;\n  isGenerating: boolean;\n  onCopy: (t: string) => void;\n  onResend?: (content: string) => void;\n  onFavorite?: (content: string) => void;\n  onImageClick?: (url: string) => void;\n  onDelete?: () => void;\n  onReact?: (reaction: string) => void;\n}) {"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
