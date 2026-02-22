import { NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { invalidateRoomsCache } from '@/lib/rooms-cache';

const GLOBAL_DISCUSSION_ROOM_ID = 'public_global_discussion';
const ROOMS_COLLECTION = 'rooms';

/**
 * Crée le salon "Global Discussion" dans Firestore s'il n'existe pas.
 * Appelé au chargement de la page canal pour garantir que le salon existe.
 */
export async function GET() {
  try {
    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ success: true, created: false });
    }

    const roomRef = db.collection(ROOMS_COLLECTION).doc(GLOBAL_DISCUSSION_ROOM_ID);
    const snap = await roomRef.get();
    if (snap.exists) {
      return NextResponse.json({ success: true, created: false });
    }

    await roomRef.set({
      roomId: GLOBAL_DISCUSSION_ROOM_ID,
      name: 'Global Discussion',
      description: 'Discussion générale ouverte à tous.',
      type: 'public',
      categoryId: null,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateRoomsCache();
    return NextResponse.json({ success: true, created: true });
  } catch (err) {
    console.error('ensure-global-discussion:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
