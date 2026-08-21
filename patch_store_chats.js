import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const targetModelSwitch = `  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);`;

const replacementModelSwitch = `  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // If the model changed, clear the currentId so we don't bleed chats
      if (newSettings.model && newSettings.model !== prev.model) {
         setCurrentId(null);
      }
      
      return updated;
    });
  }, []);`;
code = code.replace(targetModelSwitch, replacementModelSwitch);

const targetCreate = `    const newConvo: Conversation = {
      id: uuidv4(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now()
    };`;

const replacementCreate = `    const newConvo: Conversation = {
      id: uuidv4(),
      title: 'New Conversation',
      messages: [],
      modelId: settings.model, // Bind chat to current model
      updatedAt: Date.now()
    };`;
code = code.replace(targetCreate, replacementCreate);

fs.writeFileSync('src/lib/store.ts', code);
