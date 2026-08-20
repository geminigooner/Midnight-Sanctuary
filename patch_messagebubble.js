import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const searchProps = `  onFavorite,
  onImageClick
}: { 
  msg: Message;
  isLast: boolean;
  isGenerating: boolean;
  onCopy: (t: string) => void;
  onResend?: (content: string) => void;
  onFavorite?: (content: string) => void;
  onImageClick?: (url: string) => void;
}) {`;

const replaceProps = `  onFavorite,
  onImageClick,
  onDelete
}: { 
  msg: Message;
  isLast: boolean;
  isGenerating: boolean;
  onCopy: (t: string) => void;
  onResend?: (content: string) => void;
  onFavorite?: (content: string) => void;
  onImageClick?: (url: string) => void;
  onDelete?: () => void;
}) {`;

const searchRender = `        {!editing && (
          <div className={\`mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity \${isUser ? 'justify-end' : 'justify-start'}\`}>`;

const replaceRender = `        {!editing && (
          <div className={\`mt-2 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity \${isUser ? 'justify-end' : 'justify-start'}\`}>`;

const searchButtons = `            {isUser && (
              <button onClick={() => { setEditing(true); setEditContent(publicText); triggerHaptic('light'); }} className="p-1.5 bg-glass rounded-lg hover:bg-white/10 hover:text-champagne text-mauve transition-colors" title="Edit"><Edit3 size={14} /></button>
            )}`;

const replaceButtons = `            {isUser && (
              <>
                <button onClick={() => { setEditing(true); setEditContent(publicText); triggerHaptic('light'); }} className="p-1.5 bg-glass rounded-lg hover:bg-white/10 hover:text-champagne text-mauve transition-colors" title="Edit"><Edit3 size={14} /></button>
                <button onClick={() => { onDelete?.(); triggerHaptic('heavy'); }} className="p-1.5 bg-glass rounded-lg hover:bg-white/10 hover:text-red-400 text-mauve transition-colors" title="Delete"><X size={14} /></button>
              </>
            )}`;

code = code.replace(searchProps, replaceProps);
code = code.replace(searchRender, replaceRender);
code = code.replace(searchButtons, replaceButtons);
fs.writeFileSync('src/components/ChatArea.tsx', code);
