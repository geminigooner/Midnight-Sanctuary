import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const docRef = doc(db, 'users', 'ahatley094@gmail.com');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log(JSON.stringify(data.conversations?.[0]?.messages?.slice(0, 3), null, 2));
  } else {
    console.log("No such document!");
  }
}
test();
