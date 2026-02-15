import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * POST body: { userIds: string[] }
 * Returns: { avatars: { [userId: string]: string } }
 * userId can be "db_123" (numeric user id) or uid string.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userIds = body.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ avatars: {} });
    }
    const uniq = [...new Set(userIds)].filter(Boolean) as string[];
    if (uniq.length === 0) return NextResponse.json({ avatars: {} });

    const dbIds: number[] = [];
    const uids: string[] = [];
    for (const id of uniq) {
      if (typeof id !== 'string') continue;
      if (id.startsWith('db_')) {
        const n = parseInt(id.replace('db_', ''), 10);
        if (!isNaN(n)) dbIds.push(n);
      } else {
        uids.push(id);
      }
    }

    const avatars: Record<string, string> = {};
    if (dbIds.length > 0) {
      const placeholders = dbIds.map(() => '?').join(',');
      const rows = await query(
        `SELECT id, avatar FROM users WHERE id IN (${placeholders}) AND avatar IS NOT NULL AND avatar != ''`,
        dbIds
      );
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        avatars[`db_${row.id}`] = row.avatar;
      }
    }
    if (uids.length > 0) {
      const placeholders = uids.map(() => '?').join(',');
      const rows = await query(
        `SELECT uid, avatar FROM users WHERE uid IN (${placeholders}) AND avatar IS NOT NULL AND avatar != ''`,
        uids
      );
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        avatars[row.uid] = row.avatar;
      }
    }

    return NextResponse.json({ avatars });
  } catch (error: any) {
    console.error('Erreur API avatars:', error);
    return NextResponse.json({ avatars: {} }, { status: 500 });
  }
}
