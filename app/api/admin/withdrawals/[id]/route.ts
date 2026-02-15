import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (Number.isNaN(idNum)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }
    const body = await request.json();
    const status = body.status; // 'approved' | 'rejected'
    const note = body.note != null ? String(body.note) : null;
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Statut invalide (approved ou rejected)' }, { status: 400 });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (useSupabase && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('withdrawal_requests')
        .update({
          status,
          processed_at: now,
          processed_by: admin.id,
          note: note ?? null,
        })
        .eq('id', idNum)
        .eq('status', 'pending');
      if (error) throw error;
    } else {
      await query(
        'UPDATE withdrawal_requests SET status = ?, processed_at = ?, processed_by = ?, note = ? WHERE id = ? AND status = ?',
        [status, now, admin.id, note, idNum, 'pending']
      );
    }

    logAdminAction({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: status === 'approved' ? 'withdrawal_approved' : 'withdrawal_rejected',
      targetType: 'withdrawal_request',
      targetId: idNum,
      details: note || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur admin withdrawal PATCH:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: error?.message },
      { status: 500 }
    );
  }
}
