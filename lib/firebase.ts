import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBXeXtfuNj4ktGWwmz07QRvDda6q7deREU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "canaldiscussion1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "canaldiscussion1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "canaldiscussion1.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "231120774067",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:231120774067:web:ef8e1a1d04040e6f49e1c6"
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de Firebase:', error);
  }
}

// Vérifier que Firebase est bien initialisé
if (typeof window !== 'undefined' && (!auth || !db)) {
  console.error('⚠️ Firebase n\'est pas correctement initialisé. Vérifiez votre configuration.');
}

export { app, db, auth };

