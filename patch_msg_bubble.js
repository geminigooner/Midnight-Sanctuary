import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `<motion.div 
      animate={{ 
        scale: settled && !reducedMotion ? [1, 1.01, 1] : 1,
      }}
      transition={bubbleMotion}
      className={\`flex \${isUser ? 'justify-end' : 'justify-start'} group w-full\`}
    >`;

const replacement = `<div 
      className={\`flex \${isUser ? 'justify-end msg-enter-user' : 'justify-start msg-enter-model'} group w-full\`}
    >`;

code = code.replace(target, replacement);

// Wait, is there a closing </motion.div> that needs replacing?
code = code.replace(/<\/motion\.div>\n\s*$/m, '</div>\n    ');

// Let's replace </motion.div> correctly for MessageBubble.
// Wait, regex might match the wrong one.
