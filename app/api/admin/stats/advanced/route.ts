import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { query } from '@/lib/db';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const analyticsCache = new Map<string, { data: unknown; expiresAt: number }>();

const BALANCE_RANGES = [
  { label: '0', min: 0, max: 0 },
  { label: '1 - 1 000', min: 1, max: 1000 },
  { label: '1 001 - 5 000', min: 1001, max: 5000 },
  { label: '5 001 - 20 000', min: 5001, max: 20000 },
  { label: '20 001+', min: 20001, max: 1e9 },
];

export async function GET(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';
  const cacheKey = `advanced:${period}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ success: true, data: cached.data, period, cached: true });
  }

  const result: {
    registrations: { date: string; count: number }[];
    messagesByPeriod: number;
    activeRooms: { roomId: string; name: string; count: number }[];
    balanceDistribution: { range: string; count: number }[];
  } = {
    registrations: [],
    messagesByPeriod: 0,
    activeRooms: [],
    balanceDistribution: [],
  };

  const now = new Date();
  let from: Date;
  if (period === 'day') from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  else if (period === 'week') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Inscriptions : depuis la base SQL (users)
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const regRows = await query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY DATE(created_at) ORDER BY d`,
      [periodDays]
    ).catch(() => []);
    result.registrations = Array.isArray(regRows)
      ? (regRows as { d: string; c: number }[]).map((r) => ({ date: r.d, count: r.c }))
      : [];
  } catch {
    // garder result.registrations vide
  }

  const db = getAdminFirestore();
  if (db) {
    try {
      const fromTimestamp = admin.firestore.Timestamp.fromDate(from);

      // Liste des salons (chats = roomIds)
      const chatsSnap = await db.collection('chats').get();
      const roomIds = chatsSnap.docs.map((d) => d.id);

      const roomCounts: Record<string, number> = {};
      let totalMessages = 0;

      for (const roomId of roomIds) {
        const countQuery = db
          .collection('chats')
          .doc(roomId)
          .collection('messages')
          .where('timestamp', '>=', fromTimestamp)
          .count();
        const countSnap = await countQuery.get();
        const count = (countSnap.data() as { count?: number } | undefined)?.count ?? 0;
        if (count > 0) {
          roomCounts[roomId] = count;
          totalMessages += count;
        }
      }

      result.messagesByPeriod = totalMessages;

      // Noms des salons (Firebase collection rooms)
      const roomsSnap = await db.collection('rooms').where('type', '==', 'public').get();
      const nameMap: Record<string, string> = {};
      roomsSnap.docs.forEach((d) => {
        const data = d.data();
        nameMap[d.id] = (data.name as string) || d.id;
      });

      result.activeRooms = Object.entries(roomCounts)
        .map(([roomId, count]) => ({ roomId, name: nameMap[roomId] || roomId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Répartition des soldes (wallets Firebase)
      const walletsSnap = await db.collection('wallets').get();
      const balances = walletsSnap.docs.map((d) => Number(d.data().balance) || 0);
      result.balanceDistribution = BALANCE_RANGES.map((r) => ({
        range: r.label,
        count: balances.filter((b) => b >= r.min && b <= r.max).length,
      }));
    } catch (err: any) {
    logger.error('Erreur admin stats/advanced (Firebase)', { err: err?.message });
  }
  }

  if (result.messagesByPeriod === 0 && result.balanceDistribution.every((r) => r.count === 0)) {
    try {
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
      const msgRows = await query(
        `SELECT COUNT(*) AS c FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [periodDays]
      ).catch(() => []);
      result.messagesByPeriod = Array.isArray(msgRows) && msgRows.length > 0 ? Number((msgRows[0] as { c: number }).c) : 0;

      const activeRows = await query(
        `SELECT room_id, COUNT(*) AS c FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY room_id ORDER BY c DESC LIMIT 10`,
        [periodDays]
      ).catch(() => []);
      const roomIds = Array.isArray(activeRows) ? (activeRows as { room_id: string; c: number }[]).map((r) => r.room_id) : [];
      if (roomIds.length > 0) {
        const placeholders = roomIds.map(() => '?').join(',');
        const nameRows = await query(`SELECT room_id, name FROM rooms WHERE room_id IN (${placeholders})`, roomIds).catch(() => []);
        const nameMap: Record<string, string> = {};
        Array.isArray(nameRows) && nameRows.forEach((r: any) => { nameMap[r.room_id] = r.name || r.room_id; });
        result.activeRooms = (Array.isArray(activeRows) ? activeRows : []).map((r: any) => ({
          roomId: r.room_id,
          name: nameMap[r.room_id] || r.room_id,
          count: r.c,
        }));
      }

      const balanceRows = await query(
        `SELECT 
          SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END) AS r0,
          SUM(CASE WHEN balance > 0 AND balance <= 1000 THEN 1 ELSE 0 END) AS r1,
          SUM(CASE WHEN balance > 1000 AND balance <= 5000 THEN 1 ELSE 0 END) AS r2,
          SUM(CASE WHEN balance > 5000 AND balance <= 20000 THEN 1 ELSE 0 END) AS r3,
          SUM(CASE WHEN balance > 20000 THEN 1 ELSE 0 END) AS r4
        FROM wallets`
      ).catch(() => []);
      const r = Array.isArray(balanceRows) && balanceRows.length > 0 ? (balanceRows[0] as any) : {};
      result.balanceDistribution = [
        { range: '0', count: Number(r.r0) || 0 },
        { range: '1 - 1 000', count: Number(r.r1) || 0 },
        { range: '1 001 - 5 000', count: Number(r.r2) || 0 },
        { range: '5 001 - 20 000', count: Number(r.r3) || 0 },
        { range: '20 001+', count: Number(r.r4) || 0 },
      ];
    } catch {
      // fallback déjà à vide
    }
  }

  analyticsCache.set(cacheKey, { data: result, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });
  return NextResponse.json({ success: true, data: result, period });
}
