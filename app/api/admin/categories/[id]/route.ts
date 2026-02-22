import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';
import { invalidateRoomsCache } from '../../../../../lib/rooms-cache';

const CATEGORIES_COLLECTION = 'categories';
const ROOMS_COLLECTION = 'rooms';

function slug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

export interface MappedCategory {
  id: string;
  name: string;
  order: number;
  createdAt: string;
}

function mapCategory(docId: string, d: Record<string, unknown>): MappedCategory {
  const raw = d.createdAt;
  const createdAt =
    raw && typeof raw === 'object' && typeof (raw as { toMillis?: () => number }).toMillis === 'function'
      ? new Date((raw as { toMillis: () => number }).toMillis()).toISOString()
      : typeof raw === 'string'
        ? raw
        : '';
  return {
    id: docId,
    name: String(d.name ?? ''),
    order: Number(d.order ?? 0),
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
    const { id: categoryId } = await params;
    if (!categoryId || typeof categoryId !== 'string') {
      return NextResponse.json({ error: 'Identifiant de catégorie requis' }, { status: 400 });
    }

    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const order = body.order !== undefined ? Number(body.order) : undefined;
    if (name === undefined && order === undefined) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore non configuré.' }, { status: 503 });
    }

    const catRef = db.collection(CATEGORIES_COLLECTION).doc(categoryId);
    const catSnap = await catRef.get();
    if (!catSnap.exists) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (order !== undefined) updates.order = order;
    await catRef.update(updates);

    if (name !== undefined) {
      const oldName = String(catSnap.data()?.name ?? '');
      const globalRoomName = `Global ${name}`;
      const roomsSnap = await db.collection(ROOMS_COLLECTION).where('categoryId', '==', categoryId).get();
      for (const roomDoc of roomsSnap.docs) {
        const data = roomDoc.data();
        const roomName = String(data.name ?? '');
        if (roomName === `Global ${oldName}`) {
          await roomDoc.ref.update({ name: globalRoomName });
          break;
        }
      }
      invalidateRoomsCache();
    }

    const updated = await catRef.get();
    const admin = await getCurrentAdminUser();
    if (admin) {
      logAdminAction({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'category_updated',
        targetType: 'category',
        targetId: categoryId,
      });
    }
    const category = mapCategory(categoryId, updated.data() || {});
    return NextResponse.json({ success: true, category });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Erreur admin PATCH category:', err);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la catégorie', details: err?.message },
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
    const { id: categoryId } = await params;
    if (!categoryId || typeof categoryId !== 'string') {
      return NextResponse.json({ error: 'Identifiant de catégorie requis' }, { status: 400 });
    }

    const url = new URL(request.url);
    const deleteRooms = url.searchParams.get('deleteRooms') === 'true';

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore non configuré.' }, { status: 503 });
    }

    const catRef = db.collection(CATEGORIES_COLLECTION).doc(categoryId);
    const catSnap = await catRef.get();
    if (!catSnap.exists) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }

    const roomsSnap = await db.collection(ROOMS_COLLECTION).where('categoryId', '==', categoryId).get();
    const batch = db.batch();
    if (deleteRooms) {
      for (const roomDoc of roomsSnap.docs) {
        batch.delete(roomDoc.ref);
      }
    } else {
      for (const roomDoc of roomsSnap.docs) {
        batch.update(roomDoc.ref, { categoryId: firebaseAdmin.firestore.FieldValue.delete() });
      }
    }
    if (!roomsSnap.empty) await batch.commit();
    await catRef.delete();
    invalidateRoomsCache();

    const admin = await getCurrentAdminUser();
    if (admin) {
      logAdminAction({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'category_deleted',
        targetType: 'category',
        targetId: categoryId,
      });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Erreur admin DELETE category:', err);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la catégorie', details: err?.message },
      { status: 500 }
    );
  }
}
