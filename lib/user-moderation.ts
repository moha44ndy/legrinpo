import { supabaseAdmin } from '@/lib/supabase';

export interface BlockedUserEntry {
  userId: string;
  username: string;
  blockedAt: string;
}

function requireDb() {
  if (!supabaseAdmin) {
    throw new Error('Base de données non configurée (Supabase).');
  }
  return supabaseAdmin;
}

export async function getTermsAccepted(userDbId: number): Promise<boolean> {
  const db = requireDb();
  const { data, error } = await db
    .from('users')
    .select('terms_accepted_at')
    .eq('id', userDbId)
    .maybeSingle();

  if (error) {
    console.error('getTermsAccepted:', error.message);
    return false;
  }
  return !!data?.terms_accepted_at;
}

export async function acceptTerms(userDbId: number): Promise<void> {
  const db = requireDb();
  const now = new Date().toISOString();
  const { error } = await db
    .from('users')
    .update({ terms_accepted_at: now, updated_at: now })
    .eq('id', userDbId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getBlockedUsers(userDbId: number): Promise<BlockedUserEntry[]> {
  const db = requireDb();
  const { data, error } = await db
    .from('blocked_users')
    .select('blocked_uid, blocked_username, created_at')
    .eq('user_id', userDbId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getBlockedUsers:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    userId: row.blocked_uid,
    username: row.blocked_username || 'Utilisateur',
    blockedAt: row.created_at || '',
  }));
}

export async function blockUser(
  userDbId: number,
  blockedUserId: string,
  blockedUsername: string
): Promise<void> {
  if (!blockedUserId || blockedUserId.trim() === '') {
    throw new Error('Utilisateur invalide');
  }

  const db = requireDb();
  const { error } = await db.from('blocked_users').upsert(
    {
      user_id: userDbId,
      blocked_uid: blockedUserId.trim(),
      blocked_username: blockedUsername.slice(0, 100),
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,blocked_uid' }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function unblockUser(userDbId: number, blockedUserId: string): Promise<void> {
  const db = requireDb();
  const { error } = await db
    .from('blocked_users')
    .delete()
    .eq('user_id', userDbId)
    .eq('blocked_uid', blockedUserId.trim());

  if (error) {
    throw new Error(error.message);
  }
}

export async function getBlockedUserIds(userDbId: number): Promise<string[]> {
  const list = await getBlockedUsers(userDbId);
  return list.map((b) => b.userId);
}
