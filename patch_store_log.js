import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace("setDataLoaded(true);", "console.log('LOADING DATA from firestore, conversations count:', data.conversations ? data.conversations.length : 0);\n          setDataLoaded(true);");

code = code.replace("setDoc(userDocRef, payload, { merge: true });", "console.log('SAVING DATA to firestore, conversations count:', conversations.length, 'dataLoaded:', dataLoaded);\n        setDoc(userDocRef, payload, { merge: true });");

fs.writeFileSync('src/lib/store.ts', code);
