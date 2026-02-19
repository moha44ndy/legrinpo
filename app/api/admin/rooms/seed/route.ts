import { NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

const ROOMS_COLLECTION = 'rooms';

const DEFAULT_ROOMS = [
  { roomId: 'public_aes', name: 'AES', description: 'Alliance des États du Sahel' },
  { roomId: 'public_cemac', name: 'CEMAC', description: 'Communauté Économique et Monétaire' },
  { roomId: 'public_uemoa', name: 'UEMOA', description: 'Union Économique' },
  { roomId: 'public_autres', name: 'Globale Organisation', description: 'Organisation Globale' },
];

export async function POST() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firestore non configuré (Firebase Admin).' },
        { status: 503 }
      );
    }

    let created = 0;
    for (const room of DEFAULT_ROOMS) {
      const docRef = db.collection(ROOMS_COLLECTION).doc(room.roomId);
      const existing = await docRef.get();
      if (!existing.exists) {
        await docRef.set({
          roomId: room.roomId,
          name: room.name,
          description: room.description,
          type: 'public',
          createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      message: created > 0 ? `${created} salon(s) par défaut créé(s).` : 'Les 4 salons par défaut existent déjà.',
      created,
    });
  } catch (error: any) {
    console.error('Erreur seed rooms:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création des salons par défaut', details: error?.message },
      { status: 500 }
    );
  }
}
