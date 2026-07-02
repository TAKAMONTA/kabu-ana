import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function isFirebaseConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return Boolean(
    apiKey &&
      projectId &&
      apiKey !== "your_firebase_api_key_here" &&
      apiKey !== "demo-key" &&
      projectId !== "demo-project"
  );
}

const firebaseConfig = isFirebaseConfigured()
  ? {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    }
  : null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (typeof window !== "undefined" && firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  if (process.env.NODE_ENV === "development") {
    (window as unknown as { __firebaseAuth?: Auth; __firebaseDb?: Firestore }).__firebaseAuth =
      auth;
    (window as unknown as { __firebaseAuth?: Auth; __firebaseDb?: Firestore }).__firebaseDb =
      db;
  }
}

export { auth, db, isFirebaseConfigured };
export default app;
