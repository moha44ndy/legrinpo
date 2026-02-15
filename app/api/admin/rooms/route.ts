import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

function mapRoom(r: any) {
  return {
    id: r.id,
    roomId: r.room_id ?? r.roomId ?? '',
    name: r.name ?? '',
    description: r.description ?? '',
    type: r.type ?? 'public',
    createdAt: r.created_at ?? '',
  };
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    let rows: any[] = [];

    if (useSupabase && supabaseAdmin) {
      // Supabase : appel direct pour appliquer le filtre type = 'public'
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('id, room_id, name, description, type, created_at')
        .eq('type', 'public')
        .order('name');
      if (error) {
        // Table absente ou autre erreur : renvoyer liste vide au lieu d'erreur
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          rows = [];
        } else {
          console.error('Erreur Supabase rooms:', error);
          return NextResponse.json(
            { error: 'Erreur chargement des salons', details: error.message },
            { status: 500 }
          );
        }
      } else {
        rows = data ?? [];
      }
    } else {
      // MySQL
      const result = await query(
        "SELECT id, room_id, name, description, type, created_at FROM rooms WHERE type = 'public' ORDER BY name"
      ).catch((err) => {
        console.error('Erreur MySQL rooms:', err);
        return [];
      });
      rows = Array.isArray(result) ? result : [];
    }

    const rooms = rows.map(mapRoom);
    return NextResponse.json({ success: true, rooms });
  } catch (error: any) {
    console.error('Erreur admin rooms:', error);
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

    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .insert({
          room_id: roomId,
          name,
          description: description || null,
          type: 'public',
        })
        .select('id, room_id, name, description, type, created_at')
        .single();
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Un salon avec cet identifiant existe déjà' }, { status: 400 });
        }
        throw error;
      }
      const admin = await getCurrentAdminUser();
      if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_created', targetType: 'room', targetId: data?.id, details: name });
      return NextResponse.json({ success: true, room: mapRoom(data) });
    }

    await query(
      'INSERT INTO rooms (room_id, name, description, type) VALUES (?, ?, ?, ?)',
      [roomId, name, description || null, 'public']
    );
    const inserted = await query(
      'SELECT id, room_id, name, description, type, created_at FROM rooms WHERE room_id = ?',
      [roomId]
    );
    const row = Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : null;
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_created', targetType: 'room', targetId: row?.id, details: name });
    return NextResponse.json({ success: true, room: row ? mapRoom(row) : { roomId, name, description, type: 'public' } });
  } catch (error: any) {
    console.error('Erreur admin create room:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du salon', details: error?.message },
      { status: 500 }
    );
  }
}
