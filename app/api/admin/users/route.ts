import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const rows = await query(
      'SELECT id, uid, email, username, display_name, COALESCE(is_admin, 0) AS is_admin, COALESCE(is_disabled, 0) AS is_disabled, created_at FROM users ORDER BY id'
    );
    const users = Array.isArray(rows)
      ? rows
          .map((r: any) => ({
            id: r.id,
            uid: r.uid ?? '',
            email: r.email ?? '',
            username: r.username ?? '',
            displayName: r.display_name ?? r.displayName ?? '',
            isAdmin: !!(r.is_admin ?? r.isAdmin ?? 0),
            isDisabled: !!(r.is_disabled ?? r.isDisabled ?? 0),
            createdAt: r.created_at ?? '',
          }))
          .sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
      : [];
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Erreur admin users:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des utilisateurs', details: error?.message },
      { status: 500 }
    );
  }
}
