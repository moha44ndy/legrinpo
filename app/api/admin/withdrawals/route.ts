import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    let rows: any[] = [];
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error) rows = data || [];
    } else {
      const result = await query(
        'SELECT * FROM withdrawal_requests ORDER BY created_at DESC LIMIT 100'
      ).catch(() => []);
      rows = Array.isArray(result) ? result : [];
    }

    const list = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      email: r.email ?? '',
      username: r.username ?? '',
      amount: Number(r.amount) || 0,
      method: r.method ?? '',
      country: r.country ?? '',
      phoneOrIban: r.phone_or_iban ?? r.phoneOrIban ?? '',
      fullName: r.full_name ?? r.fullName ?? '',
      status: r.status ?? 'pending',
      createdAt: r.created_at ?? '',
      processedAt: r.processed_at ?? r.processedAt ?? null,
      processedBy: r.processed_by ?? r.processedBy ?? null,
      note: r.note ?? null,
    }));

    return NextResponse.json({ success: true, withdrawals: list });
  } catch (error: any) {
    console.error('Erreur admin withdrawals GET:', error);
    return NextResponse.json(
      { error: 'Erreur chargement des demandes', details: error?.message },
      { status: 500 }
    );
  }
}
