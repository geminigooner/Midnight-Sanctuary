import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `        {visibleMessages.map((msg, i) => (
          <MessageBubble 
            key={msg.id}`;

const replacement = `        <motion.div 
          className="flex flex-col gap-6 w-full"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { 
              transition: { staggerChildren: 0.05 }
            }
          }}
        >
          {visibleMessages.map((msg, i) => (
            <MessageBubble 
              key={msg.id}`;

code = code.replace(target, replacement);

const target2 = `            onDelete={() => onRemoveMessage(conversation.id, msg.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>`;

const replacement2 = `            onDelete={() => onRemoveMessage(conversation.id, msg.id)}
            />
          ))}
          <div ref={bottomRef} />
        </motion.div>
      </div>`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ChatArea.tsx', code);
