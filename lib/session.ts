import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export interface SessionUser {
  id: number;
  uid: string;
  email: string;
  username: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;

  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    const users = await query(
      'SELECT id, uid, email, username, COALESCE(is_disabled, 0) AS is_disabled FROM users WHERE id = ?',
      [userId]
    );
    if (!Array.isArray(users) || users.length === 0) return null;
    const u = users[0] as { id: number; uid: string; email: string; username: string; is_disabled: number };
    if (u.is_disabled) return null;
    return { id: u.id, uid: u.uid, email: u.email, username: u.username };
  } catch {
    return null;
  }
}
