import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// 1. Add bottomRef
code = code.replace(
  'const conversationRef = useRef(conversation);',
  'const bottomRef = useRef<HTMLDivElement>(null);\n  const conversationRef = useRef(conversation);'
);

// 2. Modify scroll effect
code = code.replace(
  `  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, isGenerating]);`,
  `  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation?.messages, isGenerating]);`
);

// 3. Modify scroll container className
code = code.replace(
  'className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6 custom-scrollbar z-10 scroll-smooth w-full min-w-0 max-w-full"',
  'className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6 custom-scrollbar z-10 min-h-0 w-full min-w-0 max-w-full"'
);

// 4. Add <div ref={bottomRef} /> at end of scroll container
code = code.replace(
  `            />
          ))}
        </AnimatePresence>
      </div>`,
  `            />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>`
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
