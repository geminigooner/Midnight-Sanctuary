const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const undefinedCleaner = `function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        newObj[key] = removeUndefined(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export function useAppStore`;

code = code.replace("export function useAppStore", undefinedCleaner);

// Fix 1: Debounce save
const oldDebounceSave = `await setDoc(userDocRef, payload, { merge: true });`;
const newDebounceSave = `await setDoc(userDocRef, removeUndefined(payload), { merge: true });`;
code = code.replace(oldDebounceSave, newDebounceSave);

// Fix 2: addMemory
const oldAddMemorySave = `setDoc(doc(db, 'users', user.uid), { settings: nextSettings }, { merge: true })`;
const newAddMemorySave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ settings: nextSettings }), { merge: true })`;
code = code.replace(oldAddMemorySave, newAddMemorySave);

// Fix 3: addMessage
const oldAddMessageSave = `setDoc(doc(db, 'users', user.uid), { conversations: next }, { merge: true })`;
const newAddMessageSave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })`;
code = code.replace(oldAddMessageSave, newAddMessageSave);

// Fix 4: updateMessage
const oldUpdateMessageSave = `setDoc(doc(db, 'users', user.uid), { conversations: next }, { merge: true })`;
const newUpdateMessageSave = `setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })`;
// Note: updateMessage might be using the identical string as addMessage, so we might need a regex or global replace.
code = code.replace(/setDoc\(doc\(db, 'users', user\.uid\), \{ conversations: next \}, \{ merge: true \}\)/g, newUpdateMessageSave);

fs.writeFileSync('src/lib/store.ts', code);
console.log('Patched store.ts with removeUndefined');
