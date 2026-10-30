import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
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
      localCache: persistentLocalCache({}),
    }, dbId);
  } else {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({}),
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

export { signInWithPopup, signOut, onAuthStateChanged };
