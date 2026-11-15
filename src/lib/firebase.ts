import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.warn('Firebase initializeApp fallback:', e);
  app = initializeApp(firebaseConfig, 'sanctuary-app');
}

// Initialize Firestore with client-side persistent cache, falling back gracefully
let firestoreInstance: any;
const dbId = firebaseConfig.firestoreDatabaseId || undefined;

try {
  if (dbId) {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, dbId);
  } else {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }
} catch {
  try {
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  void testConnection();
}

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged };
