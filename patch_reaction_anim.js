import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `        {msg.reaction && (
          <div className={\`absolute \${isUser ? '-left-3' : '-right-3'} -bottom-3 bg-ink border border-glass-border rounded-full p-1.5 shadow-md text-sm z-10 animate-in zoom-in duration-300\`}>
            {msg.reaction}
          </div>
        )}`;

const replacement = `        <AnimatePresence>
          {msg.reaction && (
            <motion.div 
              key={msg.reaction}
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0 }}
              whileHover={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.8 }}
              className={\`absolute \${isUser ? '-left-3' : '-right-3'} -bottom-3 bg-ink border border-glass-border rounded-full p-1.5 shadow-md text-sm z-10 cursor-pointer\`}
            >
              {msg.reaction}
            </motion.div>
          )}
        </AnimatePresence>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
