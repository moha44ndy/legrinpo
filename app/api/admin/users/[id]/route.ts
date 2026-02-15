import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';

async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    return parseInt(userId, 10);
  } catch {
    return null;
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
    const currentId = await getCurrentUserId();
    if (currentId !== null && currentId === idNum) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
    }
    try {
      await query('DELETE FROM transactions WHERE user_id = ?', [idNum]);
    } catch {
      // Table transactions peut ne pas exister
    }
    try {
      await query('DELETE FROM wallets WHERE user_id = ?', [idNum]);
    } catch {
      // Table wallets peut ne pas exister (ex. Supabase sans wallets)
    }
    await query('DELETE FROM users WHERE id = ?', [idNum]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur admin delete user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: error?.message },
      { status: 500 }
    );
  }
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
    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];
    if (typeof body.isAdmin === 'boolean') {
      updates.push('is_admin = ?');
      values.push(body.isAdmin ? 1 : 0);
    }
    if (typeof body.isDisabled === 'boolean') {
      updates.push('is_disabled = ?');
      values.push(body.isDisabled ? 1 : 0);
    }
    if (body.username !== undefined && typeof body.username === 'string') {
      updates.push('username = ?');
      values.push(body.username.trim());
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }
    values.push(id);
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'user_updated', targetType: 'user', targetId: id, details: JSON.stringify(body) });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur admin update user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: error?.message },
      { status: 500 }
    );
  }
}
