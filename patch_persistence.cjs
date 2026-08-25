const fs = require('fs');
let code = fs.readFileSync('src/lib/persistenceSystem.ts', 'utf8');

const oldLoadState = `export function loadState(userId: string, onData: (data: any) => void) {
  const userDocRef = doc(db, 'users', userId);
  return onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      onData(docSnap.data());
    } else {
      onData(null);
    }
  }, (error) => {
    console.error("Firestore onSnapshot error:", error);
  });
}`;

const newLoadState = `export function loadState(userId: string, onData: (data: any) => void) {
  const userDocRef = doc(db, 'users', userId);
  
  import('firebase/firestore').then(({ getDoc }) => {
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        onData(docSnap.data());
      } else {
        onData(null);
      }
    }).catch((error) => {
      console.error("Firestore getDoc error:", error);
      onData(null);
    });
  });

  return () => {}; // return dummy unsubscribe
}`;

code = code.replace(oldLoadState, newLoadState);
fs.writeFileSync('src/lib/persistenceSystem.ts', code);
console.log('Patched persistenceSystem.ts');
