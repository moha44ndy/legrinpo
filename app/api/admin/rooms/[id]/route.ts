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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (Number.isNaN(idNum)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const description = body.description !== undefined ? String(body.description).trim() : undefined;
    if (name === undefined && description === undefined) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    if (useSupabase && supabaseAdmin) {
      const updates: Record<string, string | null> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .update(updates)
        .eq('id', idNum)
        .eq('type', 'public')
        .select('id, room_id, name, description, type, created_at')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, room: mapRoom(data) });
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    values.push(idNum);
    await query(
      `UPDATE rooms SET ${updates.join(', ')} WHERE id = ? AND type = 'public'`,
      values
    );
    const rows = await query(
      'SELECT id, room_id, name, description, type, created_at FROM rooms WHERE id = ?',
      [idNum]
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_updated', targetType: 'room', targetId: idNum });
    return NextResponse.json({ success: true, room: row ? mapRoom(row) : null });
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
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (Number.isNaN(idNum)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    if (useSupabase && supabaseAdmin) {
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('room_id')
        .eq('id', idNum)
        .eq('type', 'public')
        .single();
      if (!room?.room_id) {
        return NextResponse.json({ error: 'Salon non trouvé ou non supprimable' }, { status: 404 });
      }
      await supabaseAdmin.from('messages').delete().eq('room_id', room.room_id).then(() => {}).catch(() => {});
      const { error } = await supabaseAdmin.from('rooms').delete().eq('id', idNum);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const rows = await query('SELECT room_id FROM rooms WHERE id = ? AND type = ?', [idNum, 'public']);
    const roomId = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any)?.room_id : null;
    if (!roomId) {
      return NextResponse.json({ error: 'Salon non trouvé ou non supprimable' }, { status: 404 });
    }
    await query('DELETE FROM messages WHERE room_id = ?', [roomId]).catch(() => {});
    await query('DELETE FROM rooms WHERE id = ?', [idNum]);
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'room_deleted', targetType: 'room', targetId: idNum });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur admin delete room:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du salon', details: error?.message },
      { status: 500 }
    );
  }
}
