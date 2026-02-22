import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from 'firebase-admin';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';
import { invalidateRoomsCache } from '../../../../lib/rooms-cache';
import { SITE_COUNTRIES } from '@/lib/countries';

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

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firestore non configuré.' },
        { status: 503 }
      );
    }

    const snapshot = await db.collection(CATEGORIES_COLLECTION).orderBy('order', 'asc').get();
    const categories: MappedCategory[] = snapshot.docs
      .map((doc) => {
      const d = doc.data();
      const raw = d.createdAt;
      const createdAt =
        raw && typeof raw === 'object' && typeof (raw as { toMillis?: () => number }).toMillis === 'function'
          ? new Date((raw as { toMillis: () => number }).toMillis()).toISOString()
          : typeof raw === 'string'
            ? raw
            : '';
      return {
        id: doc.id,
        name: String(d.name ?? ''),
        order: Number(d.order ?? 0),
        createdAt,
      };
    })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return NextResponse.json({ success: true, categories });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Erreur admin categories GET:', err);
    return NextResponse.json(
      { error: 'Erreur chargement des catégories', details: err?.message },
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
    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Le nom de la catégorie est requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Firestore non configuré.' },
        { status: 503 }
      );
    }

    let order: number;
    if (body.order != null && body.order !== '') {
      order = Number(body.order);
    } else {
      const existingSnap = await db.collection(CATEGORIES_COLLECTION).get();
      const maxOrder = existingSnap.empty
        ? -1
        : Math.max(...existingSnap.docs.map((d) => Number(d.data().order ?? 0)));
      order = maxOrder + 1;
    }

    const catRef = db.collection(CATEGORIES_COLLECTION).doc();
    const categoryId = catRef.id;

    await catRef.set({
      name,
      order,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });

    const globalRoomName = `Global ${name}`;
    const globalRoomId = 'public_global_' + (slug(name) || categoryId);

    const roomRef = db.collection(ROOMS_COLLECTION).doc(globalRoomId);
    const existingRoom = await roomRef.get();
    if (!existingRoom.exists) {
      await roomRef.set({
        roomId: globalRoomId,
        name: globalRoomName,
        description: `Salon global de la catégorie ${name}.`,
        type: 'public',
        categoryId,
        createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Salons par pays : "[Nom catégorie] [Nom pays]" (14 salons)
    const catSlug = slug(name) || categoryId;
    for (const country of SITE_COUNTRIES) {
      const countryRoomName = `${name} ${country}`;
      const countryRoomId = 'public_' + catSlug + '_' + slug(country);
      const countryRoomRef = db.collection(ROOMS_COLLECTION).doc(countryRoomId);
      const countryRoomExists = await countryRoomRef.get();
      if (!countryRoomExists.exists) {
        await countryRoomRef.set({
          roomId: countryRoomId,
          name: countryRoomName,
          description: `Salon ${name} pour ${country}.`,
          type: 'public',
          categoryId,
          createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    invalidateRoomsCache();

    const currentAdmin = await getCurrentAdminUser();
    if (currentAdmin) {
      logAdminAction({
        adminUserId: currentAdmin.id,
        adminEmail: currentAdmin.email,
        action: 'category_created',
        targetType: 'category',
        targetId: categoryId,
        details: name,
      });
    }

    const category: MappedCategory = {
      id: categoryId,
      name,
      order,
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, category });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Erreur admin create category:', err);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la catégorie', details: err?.message },
      { status: 500 }
    );
  }
}
