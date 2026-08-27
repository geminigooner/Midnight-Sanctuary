import { db } from './src/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function saveConversation(userId: string, conversations: any[]) {
  return setDoc(doc(db, 'users', userId), { conversations }, { merge: true });
}
