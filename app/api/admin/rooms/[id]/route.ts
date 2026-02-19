import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';
import { invalidateRoomsCache } from '../../../../../lib/rooms-cache';

const ROOMS_COLLECTION = 'rooms';

function mapRoom(docId: string, data: Record<string, unknown> & { createdAt?: { toMillis?: () => number } | string }) {
  const raw = data.createdAt;
  const createdAt = raw && typeof raw === 'object' && typeof (raw as { toMillis?: () => number }).toMillis === 'function'
    ? new Date((raw as { toMillis: () => number }).toMillis()).toISOString()
    : (typeof raw === 'string' ? raw : '');
  return {
    id: docId,
    roomId: docId,
    name: data.name ?? '',
    description: data.description ?? '',
    type: data.type ?? 'public',
    createdAt,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id: roomId } = await params;
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Identifiant du salon requis' }, { status: 400 });
    }

    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const description = body.description !== undefined ? String(body.description).trim() : undefined;
    if (name === undefined && description === undefined) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore non configuré (Firebase Admin).' }, { status: 503 });
    }

    const docRef = db.collection(ROOMS_COLLECTION).doc(roomId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    const updates: Record<string, string> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    await docRef.update(updates);
    invalidateRoomsCache();

    const updated = await docRef.get();
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_updated', targetType: 'room', targetId: roomId });

    const room = mapRoom(roomId, updated.data() || {});
    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error('Erreur admin update room:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du salon', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id: roomId } = await params;
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Identifiant du salon requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore non configuré (Firebase Admin).' }, { status: 503 });
    }

    const docRef = db.collection(ROOMS_COLLECTION).doc(roomId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Salon non trouvé ou non supprimable' }, { status: 404 });
    }

    await docRef.delete();
    invalidateRoomsCache();

    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_deleted', targetType: 'room', targetId: roomId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur admin delete room:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du salon', details: error?.message },
      { status: 500 }
    );
  }
}
