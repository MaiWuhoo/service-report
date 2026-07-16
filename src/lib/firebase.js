import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;

/**
 * Firestore rules (firestore.rules) require request.auth != null.
 * This app has no login form yet, so we sign everyone in anonymously
 * in the background — that's enough to satisfy the rules and lets you
 * add real login later without changing the rules shape.
 *
 * IMPORTANT: enable "Anonymous" under Firebase Console → Authentication
 * → Sign-in method, or this will silently fail and every write
 * (New Service Report, Confirm Schedule, etc.) will do nothing.
 */
export const authReady = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user);
    } else {
      signInAnonymously(auth).catch(reject);
    }
  }, reject);
});
