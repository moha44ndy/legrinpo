import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function isCurrentUserAdmin(): Promise<boolean> {
  const admin = await getCurrentAdminUser();
  return admin != null;
}

export async function getCurrentAdminUser(): Promise<{ id: number; email: string } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    const users = await query(
      'SELECT id, email, COALESCE(is_admin, 0) AS is_admin FROM users WHERE id = ?',
      [userId]
    );
    if (!Array.isArray(users) || users.length === 0) return null;
    const u = users[0] as { id: number; email: string; is_admin: number };
    if (!u.is_admin) return null;
    return { id: u.id, email: u.email };
  } catch {
    return null;
  }
}
