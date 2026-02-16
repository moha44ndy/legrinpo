import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET(request: NextRequest) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    let rows: any[] = [];

    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('id, user_id, type, amount, reason, room_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error) rows = data || [];
    } else {
      const result = await query(
        `SELECT t.id, t.user_id, t.type, t.amount, t.reason, t.room_id, t.created_at
         FROM transactions t
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [limit]
      ).catch(() => []);
      rows = Array.isArray(result) ? result : [];
    }

    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const userMap: Record<number, { email: string; username: string }> = {};
    if (userIds.length > 0) {
      if (useSupabase && supabaseAdmin) {
        const { data: users } = await supabaseAdmin.from('users').select('id, email, username').in('id', userIds);
        (users || []).forEach((u: any) => { userMap[u.id] = { email: u.email || '', username: u.username || '' }; });
      } else {
        const placeholders = userIds.map(() => '?').join(',');
        const userRows = await query(`SELECT id, email, username FROM users WHERE id IN (${placeholders})`, userIds).catch(() => []);
        Array.isArray(userRows) && userRows.forEach((u: any) => { userMap[u.id] = { email: u.email || '', username: u.username || '' }; });
      }
    }

    const transactions = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      email: userMap[r.user_id]?.email ?? '',
      username: userMap[r.user_id]?.username ?? '',
      type: r.type || 'earn',
      amount: Number(r.amount) || 0,
      reason: r.reason || null,
      roomId: r.room_id || null,
      createdAt: r.created_at || '',
    }));

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    console.error('Erreur admin transactions:', error);
    return NextResponse.json(
      { error: 'Erreur chargement des transactions', details: error?.message },
      { status: 500 }
    );
  }
}
