const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const oldAddMessage = `  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, messages: [...(c.messages || []), message], updatedAt: Date.now() } : c
    ));
  }, []);`;

const newAddMessage = `  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => {
      const next = prev.map(c => 
        c.id === conversationId ? { ...c, messages: [...(c.messages || []), message], updatedAt: Date.now() } : c
      );
      if (user) {
        setDoc(doc(db, 'users', user.uid), { conversations: next }, { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (addMessage):', e));
      }
      return next;
    });
  }, [user]);`;

const oldUpdateMessage = `  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { 
        ...c, 
        messages: (c.messages || []).map(m => {
          if (m.id === messageId) {
            const safeUpdates = { ...updates };
            if (safeUpdates.parts && safeUpdates.parts.length === 0) {
              safeUpdates.parts = [{ text: '' }];
            }
            return { ...m, ...safeUpdates };
          }
          return m;
        }),
        updatedAt: Date.now() 
      } : c
    ));
  }, []);`;

const newUpdateMessage = `  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setConversations(prev => {
      const next = prev.map(c => 
        c.id === conversationId ? { 
          ...c, 
          messages: (c.messages || []).map(m => {
            if (m.id === messageId) {
              const safeUpdates = { ...updates };
              if (safeUpdates.parts && safeUpdates.parts.length === 0) {
                safeUpdates.parts = [{ text: '' }];
              }
              return { ...m, ...safeUpdates };
            }
            return m;
          }),
          updatedAt: Date.now() 
        } : c
      );
      if (user && updates.status === 'complete') {
        setDoc(doc(db, 'users', user.uid), { conversations: next }, { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (updateMessage):', e));
      }
      return next;
    });
  }, [user]);`;

const oldAddMemory = `  const addMemory = useCallback((memoryContent: string, origin?: string, author?: 'user'|'model', modelId?: string, caption?: string) => {
    setSettings(prev => {
      const newMemory = {
        id: uuidv4(),
        content: memoryContent,
        createdAt: Date.now(),
        origin,
        author,
        modelId,
        caption
      };
      return {
        ...prev,
        memories: [newMemory, ...(prev.memories || [])]
      };
    });
  }, []);`;

const newAddMemory = `  const addMemory = useCallback((memoryContent: string, origin?: string, author?: 'user'|'model', modelId?: string, caption?: string) => {
    setSettings(prev => {
      const newMemory = {
        id: uuidv4(),
        content: memoryContent,
        createdAt: Date.now(),
        origin,
        author,
        modelId,
        caption
      };
      const nextSettings = {
        ...prev,
        memories: [newMemory, ...(prev.memories || [])]
      };
      if (user) {
        setDoc(doc(db, 'users', user.uid), { settings: nextSettings }, { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (addMemory):', e));
      }
      return nextSettings;
    });
  }, [user]);`;

code = code.replace(oldAddMessage, newAddMessage);
code = code.replace(oldUpdateMessage, newUpdateMessage);
code = code.replace(oldAddMemory, newAddMemory);

fs.writeFileSync('src/lib/store.ts', code);
console.log("Patched store.ts");
