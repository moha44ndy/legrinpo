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
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    let rows: any[] = [];
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('login_logs')
        .select('id, user_id, email, ip, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error) rows = data || [];
    } else {
      const result = await query(
        'SELECT id, user_id, email, ip, created_at FROM login_logs ORDER BY created_at DESC LIMIT ?',
        [limit]
      ).catch(() => []);
      rows = Array.isArray(result) ? result : [];
    }

    const logins = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id ?? null,
      email: r.email ?? '',
      ip: r.ip ?? null,
      createdAt: r.created_at ?? '',
    }));

    return NextResponse.json({ success: true, logins });
  } catch (error: any) {
    console.error('Erreur admin logs logins:', error);
    return NextResponse.json(
      { error: 'Erreur chargement du journal', details: error?.message },
      { status: 500 }
    );
  }
}
