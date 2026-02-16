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
        .from('admin_logs')
        .select('id, admin_user_id, admin_email, action, target_type, target_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error) rows = data || [];
    } else {
      const result = await query(
        'SELECT id, admin_user_id, admin_email, action, target_type, target_id, details, created_at FROM admin_logs ORDER BY created_at DESC LIMIT ?',
        [limit]
      ).catch(() => []);
      rows = Array.isArray(result) ? result : [];
    }

    const actions = rows.map((r: any) => ({
      id: r.id,
      adminUserId: r.admin_user_id,
      adminEmail: r.admin_email ?? '',
      action: r.action ?? '',
      targetType: r.target_type ?? null,
      targetId: r.target_id ?? null,
      details: r.details ?? null,
      createdAt: r.created_at ?? '',
    }));

    return NextResponse.json({ success: true, actions });
  } catch (error: any) {
    console.error('Erreur admin logs actions:', error);
    return NextResponse.json(
      { error: 'Erreur chargement des logs', details: error?.message },
      { status: 500 }
    );
  }
}
