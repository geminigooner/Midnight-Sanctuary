import fs from 'fs';

// 1. Edit ChatArea.tsx
let chatAreaCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

chatAreaCode = chatAreaCode.replace(
  '<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>',
  '<div>'
);
chatAreaCode = chatAreaCode.replace(
  '</Markdown>\n              </motion.div>',
  '</Markdown>\n              </div>'
);

chatAreaCode = chatAreaCode.replace(
  `      className={\`flex \${isUser ? 'justify-end' : 'justify-start'} group w-full\`}
      style={{ outline: '2px solid red' }}
    >`,
  `      className={\`flex \${isUser ? 'justify-end' : 'justify-start'} group w-full\`}
    >`
);

fs.writeFileSync('src/components/ChatArea.tsx', chatAreaCode);


// 2. Edit ThoughtBubble.tsx
let thoughtBubbleCode = fs.readFileSync('src/components/ThoughtBubble.tsx', 'utf8');

thoughtBubbleCode = thoughtBubbleCode.replace(
  /<AnimatePresence>[\s\S]*?\{isOpen && \([\s\S]*?<motion\.div[\s\S]*?className="w-full overflow-hidden"[\s\S]*?>([\s\S]*?)<\/motion\.div>[\s\S]*?\)?\}[\s\S]*?<\/AnimatePresence>/m,
  `{isOpen && (
        <div className="w-full overflow-hidden">
$1        </div>
      )}`
);

fs.writeFileSync('src/components/ThoughtBubble.tsx', thoughtBubbleCode);
