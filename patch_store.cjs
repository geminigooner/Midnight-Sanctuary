const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

// 1. Remove firestore imports and add persistenceSystem imports
code = code.replace(
  "import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';",
  "import { loadState, saveConversation, saveSettings, saveMemory, saveGift } from './persistenceSystem';"
);

// 2. Remove removeUndefined from store.ts
const removeUndefinedRegex = /function removeUndefined[\s\S]*?return obj;\n}/;
code = code.replace(removeUndefinedRegex, '');

// 3. Update loadState in the first useEffect
const oldLoad = `    const userDocRef = doc(db, 'users', user.uid);
    
    let isInitialLoad = true;
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();`;
const newLoad = `    let isInitialLoad = true;
    
    const unsubscribe = loadState(user.uid, (data) => {
      if (data) {`;
code = code.replace(oldLoad, newLoad);

// Remove the else block of onSnapshot since loadState passes null if not exists
const oldElseLoad = `      } else {
        // Doc doesn't exist, this is first time
        if (isInitialLoad) {
          setDataLoaded(true);
          isInitialLoad = false;
        }
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });`;
const newElseLoad = `      } else {
        if (isInitialLoad) {
          setDataLoaded(true);
          isInitialLoad = false;
        }
      }
    });`;
code = code.replace(oldElseLoad, newElseLoad);

// 4. Update debounced save
const oldDebounce = `        const userDocRef = doc(db, 'users', user.uid);
        const payload: any = {
          conversations,
          settings,
          jewelMetrics,
          gifts
        };
        if (profile) payload.userProfile = profile;
        
        // --- DIAGNOSTICS ---
        const payloadSize = JSON.stringify(payload).length;
        console.log(\`[Diagnostic] Attempting Firestore save... Payload size approx: \${(payloadSize / 1024).toFixed(2)} KB\`);
        
        if (conversations.length > 0) {
          const sortedConvs = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          const mostRecentConv = sortedConvs[0];
          const lastMsg = mostRecentConv?.messages?.[mostRecentConv.messages.length - 1];
          if (lastMsg) {
            console.log(\`[Diagnostic] Final message in active conv reaches save path -> Role: \${lastMsg.role}, text length: \${lastMsg.publicText?.length || lastMsg.parts?.[0]?.text?.length || 0}\`);
          }
        }
        
        await setDoc(userDocRef, removeUndefined(payload), { merge: true });`;

const newDebounce = `        const payload: any = {
          conversations,
          settings,
          jewelMetrics,
          gifts
        };
        if (profile) payload.userProfile = profile;
        
        // --- DIAGNOSTICS ---
        const payloadSize = JSON.stringify(payload).length;
        console.log(\`[Diagnostic] Attempting Firestore save... Payload size approx: \${(payloadSize / 1024).toFixed(2)} KB\`);
        
        if (conversations.length > 0) {
          const sortedConvs = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          const mostRecentConv = sortedConvs[0];
          const lastMsg = mostRecentConv?.messages?.[mostRecentConv.messages.length - 1];
          if (lastMsg) {
            console.log(\`[Diagnostic] Final message in active conv reaches save path -> Role: \${lastMsg.role}, text length: \${lastMsg.publicText?.length || lastMsg.parts?.[0]?.text?.length || 0}\`);
          }
        }
        
        // Use saveSettings as the main debounced save for the full payload
        await saveSettings(user.uid, payload);`;
code = code.replace(oldDebounce, newDebounce);

// 5. Update addMemory immediate save
const oldAddMemorySave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ settings: nextSettings }), { merge: true })`;
const newAddMemorySave = `saveMemory(user.uid, { settings: nextSettings })`;
code = code.replace(oldAddMemorySave, newAddMemorySave);

// 6. Update addMessage immediate save
const oldAddMessageSave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })`;
const newAddMessageSave = `saveConversation(user.uid, { conversations: next })`;
code = code.replace(oldAddMessageSave, newAddMessageSave);

// 7. Update updateMessage immediate save
const oldUpdateMessageSave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })`;
const newUpdateMessageSave = `saveConversation(user.uid, { conversations: next })`;
code = code.replace(oldUpdateMessageSave, newUpdateMessageSave);

fs.writeFileSync('src/lib/store.ts', code);
console.log('Patched store.ts');
