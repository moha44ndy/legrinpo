/**
 * Firebase Admin SDK – utilisé côté serveur (API routes) pour Firestore.
 *
 * Option 1 (recommandé) : fichier JSON du compte de service
 *   Dans .env.local : FIREBASE_SERVICE_ACCOUNT_PATH=./groupe-politique-firebase-adminsdk-xxx.json
 *
 * Option 2 : variables d'environnement
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let adminDb: ReturnType<typeof admin.firestore> | null = null;

function getAdminFirestore(): ReturnType<typeof admin.firestore> | null {
  if (adminDb) return adminDb;

  const jsonPathRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const jsonPath = jsonPathRaw.replace(/^["']|["']$/g, '');
  if (jsonPath) {
    const candidates: string[] = path.isAbsolute(jsonPath)
      ? [path.normalize(jsonPath)]
      : [
          path.join(process.cwd(), jsonPath),
          path.join(process.cwd(), path.basename(jsonPath)),
          path.normalize(jsonPath),
        ];
    for (const resolved of candidates) {
      if (fs.existsSync(resolved)) {
        try {
          if (!admin.apps.length) {
            const keyFile = JSON.parse(fs.readFileSync(resolved, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(keyFile) });
          }
          adminDb = admin.firestore();
          return adminDb;
        } catch (e) {
          console.error('Firebase Admin init (fichier):', e);
          return null;
        }
      }
    }
    console.warn('Firebase Admin: fichier introuvable. Chemins testés:', candidates);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin: définir FIREBASE_SERVICE_ACCOUNT_PATH (fichier JSON) ou FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
    return null;
  }

  try {
    if (!admin.apps.length) {
      const decodedKey = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: decodedKey,
        }),
        projectId,
      });
    }
    adminDb = admin.firestore();
    return adminDb;
  } catch (e) {
    console.error('Firebase Admin init error:', e);
    return null;
  }
}

export { getAdminFirestore };
