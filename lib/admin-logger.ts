/**
 * Journal des connexions et des actions admin.
 * Utilise la table login_logs et admin_logs (MySQL ou Supabase).
 */

import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function logLogin(params: {
  userId: number | null;
  email: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    if (useSupabase && supabaseAdmin) {
      await supabaseAdmin.from('login_logs').insert({
        user_id: params.userId ?? null,
        email: params.email ?? null,
        ip: params.ip ?? null,
      });
      return;
    }
    await query(
      'INSERT INTO login_logs (user_id, email, ip) VALUES (?, ?, ?)',
      [params.userId ?? null, params.email ?? null, params.ip ?? null]
    ).catch(() => {});
  } catch {
    // Ne pas faire échouer la requête principale
  }
}

export async function logAdminAction(params: {
  adminUserId: number;
  adminEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  details?: string | null;
}): Promise<void> {
  try {
    if (useSupabase && supabaseAdmin) {
      await supabaseAdmin.from('admin_logs').insert({
        admin_user_id: params.adminUserId,
        admin_email: params.adminEmail ?? null,
        action: params.action,
        target_type: params.targetType ?? null,
        target_id: params.targetId != null ? String(params.targetId) : null,
        details: params.details ?? null,
      });
      return;
    }
    await query(
      'INSERT INTO admin_logs (admin_user_id, admin_email, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [
        params.adminUserId,
        params.adminEmail ?? null,
        params.action,
        params.targetType ?? null,
        params.targetId != null ? String(params.targetId) : null,
        params.details ?? null,
      ]
    ).catch(() => {});
  } catch {
    // Ne pas faire échouer l'action admin
  }
}
