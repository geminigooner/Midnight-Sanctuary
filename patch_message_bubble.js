import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `  const reducedMotion = useReducedMotion();
  const bubbleMotion = getMotion('standard', reducedMotion);

  return (
    <div 
      className={\`flex \${isUser ? 'justify-end msg-enter-user' : 'justify-start msg-enter-model'} group w-full\`}
    >`;

const replacement = `  const reducedMotion = useReducedMotion();
  const bubbleMotion = getMotion('standard', reducedMotion);

  const messageVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: 'spring', stiffness: 400, damping: 25, mass: 0.8 } 
    }
  };

  return (
    <motion.div 
      variants={reducedMotion ? {} : messageVariants}
      className={\`flex \${isUser ? 'justify-end' : 'justify-start'} group w-full\`}
    >`;

code = code.replace(target, replacement);

const target2 = `        )}
      </div>
    </div>
  );
}, (prev, next) => prev.msg === next.msg && prev.isLast === next.isLast && prev.isGenerating === next.isGenerating);`;

const replacement2 = `        )}
      </div>
    </motion.div>
  );
}, (prev, next) => prev.msg === next.msg && prev.isLast === next.isLast && prev.isGenerating === next.isGenerating);`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ChatArea.tsx', code);
