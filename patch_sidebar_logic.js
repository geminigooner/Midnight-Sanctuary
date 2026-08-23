import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// 1. Change "Search memories..." to "Search sanctuaries..."
code = code.replace(/placeholder="Search memories\.\.\."/g, 'placeholder="Search sanctuaries..."');

// 2. Filter conversations by currentModel
code = code.replace(
  /const filtered = conversations\.filter\(c =>/g,
  `const modelConversations = conversations.filter(c => !c.modelId || c.modelId === currentModel);\n  const filtered = modelConversations.filter(c =>`
);

// 3. Pass modelConversations to NebulaArchive
code = code.replace(
  /<NebulaArchive conversations=\{conversations\}/g,
  '<NebulaArchive conversations={modelConversations}'
);

// 4. Remove AnimatePresence for viewMode to ensure mobile visibility and prevent rendering bugs
const targetAnimatePresence = `      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={viewMotion}
            className="flex flex-col flex-1 overflow-hidden"
          >`;

const replacementAnimatePresence = `      <div className="flex-1 overflow-hidden flex flex-col relative">
        {viewMode === 'list' ? (
          <div className="flex flex-col flex-1 overflow-hidden">`;

code = code.replace(targetAnimatePresence, replacementAnimatePresence);

const targetNebula = `          </motion.div>
        ) : (
          <motion.div
            key="nebula"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={viewMotion}
            className="flex-1 flex overflow-hidden"
          >`;

const replacementNebula = `          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">`;

code = code.replace(targetNebula, replacementNebula);

const targetEnd = `          </motion.div>
        )}
      </AnimatePresence>`;

const replacementEnd = `          </div>
        )}
      </div>`;

code = code.replace(targetEnd, replacementEnd);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Patched Sidebar.tsx successfully");
