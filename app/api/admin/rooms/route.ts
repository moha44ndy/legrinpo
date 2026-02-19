import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';

const ROOMS_COLLECTION = 'rooms';

interface MappedRoom {
  id: string;
  roomId: string;
  name: string;
  description: string;
  type: string;
  createdAt: string;
}

function mapRoom(docId: string, data: Record<string, unknown> & { createdAt?: { toMillis?: () => number } | string }): MappedRoom {
  const raw = data.createdAt;
  const createdAt = raw && typeof raw === 'object' && typeof (raw as { toMillis?: () => number }).toMillis === 'function'
    ? new Date((raw as { toMillis: () => number }).toMillis()).toISOString()
    : (typeof raw === 'string' ? raw : '');
  return {
    id: docId,
    roomId: docId,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: String(data.type ?? 'public'),
    createdAt,
  };
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firestore non configuré (Firebase Admin). Vérifiez FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY.' },
        { status: 503 }
      );
    }

    const snapshot = await db.collection(ROOMS_COLLECTION)
      .where('type', '==', 'public')
      .get();

    const rooms = snapshot.docs
      .map((doc) => mapRoom(doc.id, doc.data()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return NextResponse.json({ success: true, rooms });
  } catch (error: any) {
    console.error('Erreur admin rooms GET:', error);
    return NextResponse.json(
      { error: 'Erreur chargement des salons', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const body = await request.json();
    const roomId = String(body.roomId ?? body.room_id ?? '').trim().replace(/[^a-z0-9_-]/gi, '_');
    const name = String(body.name ?? '').trim();
    const description = String(body.description ?? '').trim();
    if (!roomId || !name) {
      return NextResponse.json(
        { error: 'Identifiant du salon (roomId) et nom sont requis' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firestore non configuré (Firebase Admin).' },
        { status: 503 }
      );
    }

    const docRef = db.collection(ROOMS_COLLECTION).doc(roomId);
    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: 'Un salon avec cet identifiant existe déjà' }, { status: 400 });
    }

    const payload = {
      roomId,
      name,
      description: description || '',
      type: 'public',
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.set(payload);

    const currentAdmin = await getCurrentAdminUser();
    if (currentAdmin) logAdminAction({ adminUserId: currentAdmin.id, adminEmail: currentAdmin.email, action: 'room_created', targetType: 'room', targetId: roomId, details: name });

    const room = mapRoom(roomId, { ...payload, createdAt: new Date().toISOString() });
    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error('Erreur admin create room:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du salon', details: error?.message },
      { status: 500 }
    );
  }
}
