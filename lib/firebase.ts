import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Configuration Firebase (client) – à remplir dans .env.local avec les valeurs de ton projet Firebase
// Voir .env.example pour la liste des variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

// Validation de la configuration
if (typeof window !== 'undefined' && !firebaseConfig.apiKey) {
  console.warn('⚠️ NEXT_PUBLIC_FIREBASE_API_KEY n\'est pas défini dans .env.local');
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase initialisé avec succès');
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    if (db && auth && storage) {
      console.log('✅ Firestore, Auth et Storage initialisés');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error);
  }
}

// Vérifier que Firebase est bien initialisé
if (typeof window !== 'undefined' && (!auth || !db)) {
  console.warn('⚠️ Firebase n\'est pas correctement initialisé. Vérifiez votre configuration Firebase dans .env.local');
}

export { app, db, auth, storage };

