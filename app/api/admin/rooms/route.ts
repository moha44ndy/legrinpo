import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';
import { invalidateRoomsCache, getRoomsCache, setRoomsCache, ROOMS_CACHE_TTL_MS, type MappedRoom } from '@/lib/rooms-cache';

const ROOMS_COLLECTION = 'rooms';

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
        { error: 'Firestore non configuré. Dans .env.local ajoutez FIREBASE_SERVICE_ACCOUNT_PATH=./votre-fichier-compte-service.json (chemin vers le JSON téléchargé depuis la console Firebase).' },
        { status: 503 }
      );
    }

    const now = Date.now();
    const cached = getRoomsCache();
    if (cached && now - cached.at < ROOMS_CACHE_TTL_MS) {
      return NextResponse.json({ success: true, rooms: cached.rooms });
    }

    try {
      const snapshot = await db.collection(ROOMS_COLLECTION)
        .where('type', '==', 'public')
        .get();

      const rooms = snapshot.docs
        .map((doc) => mapRoom(doc.id, doc.data()))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRoomsCache(rooms, Date.now());
      return NextResponse.json({ success: true, rooms });
    } catch (firestoreErr: any) {
      const isQuota = firestoreErr?.code === 8 || String(firestoreErr?.message || '').includes('Quota exceeded') || String(firestoreErr?.code === 'RESOURCE_EXHAUSTED');
      const cachedFallback = getRoomsCache();
      if (isQuota && cachedFallback) {
        return NextResponse.json({ success: true, rooms: cachedFallback.rooms, quotaWarning: true });
      }
      if (isQuota) {
        console.error('Erreur admin rooms GET (quota Firestore):', firestoreErr?.message);
        return NextResponse.json(
          { error: 'Quota Firestore dépassé. Réessayez dans quelques minutes ou vérifiez l’usage dans la console Firebase.' },
          { status: 503 }
        );
      }
      throw firestoreErr;
    }
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
        { error: 'Firestore non configuré. Dans .env.local ajoutez FIREBASE_SERVICE_ACCOUNT_PATH=./votre-fichier-compte-service.json' },
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
    invalidateRoomsCache();

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
