import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

function removeUndefined(obj: any): any {
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

export function loadState(userId: string, onData: (data: any) => void) {
  const userDocRef = doc(db, 'users', userId);
  

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

  return () => {}; // return dummy unsubscribe
}

// Internal generic save to preserve exactly the same behavior and single-write
async function save(userId: string, payload: any) {
  return setDoc(doc(db, 'users', userId), removeUndefined(payload), { merge: true });
}

export async function saveConversation(userId: string, payload: any) {
  return save(userId, payload);
}

export async function saveMemory(userId: string, payload: any) {
  return save(userId, payload);
}

export async function saveGift(userId: string, payload: any) {
  return save(userId, payload);
}

export async function saveSettings(userId: string, payload: any) {
  return save(userId, payload);
}
