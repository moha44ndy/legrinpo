import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month'; // day | week | month

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

  try {
    if (useSupabase && supabaseAdmin) {
      const now = new Date();
      let from: Date;
      if (period === 'day') from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      else if (period === 'week') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromStr = from.toISOString().slice(0, 19);

      const resUsers = await supabaseAdmin.from('users').select('created_at').gte('created_at', fromStr);
      const rows = Array.isArray(resUsers.data) ? resUsers.data : [];
      const byDate: Record<string, number> = {};
      rows.forEach((r: { created_at?: string }) => {
        const d = r.created_at?.slice(0, 10) || '';
        if (d) byDate[d] = (byDate[d] || 0) + 1;
      });
      result.registrations = Object.entries(byDate).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

      const resMsg = await supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', fromStr);
      result.messagesByPeriod = typeof resMsg.count === 'number' ? resMsg.count : 0;

      const resMsgByRoom = await supabaseAdmin.from('messages').select('room_id').gte('created_at', fromStr);
      const msgByRoom = Array.isArray(resMsgByRoom.data) ? resMsgByRoom.data : [];
      const roomCounts: Record<string, number> = {};
      msgByRoom.forEach((r: { room_id?: string }) => {
        const id = r.room_id || '';
        if (id) roomCounts[id] = (roomCounts[id] || 0) + 1;
      });
      const roomIds = Object.keys(roomCounts).slice(0, 10);
      if (roomIds.length > 0) {
        const resRooms = await supabaseAdmin.from('rooms').select('room_id, name').in('room_id', roomIds);
        const roomsList = Array.isArray(resRooms.data) ? resRooms.data : [];
        const nameMap: Record<string, string> = {};
        roomsList.forEach((r: { room_id: string; name: string }) => { nameMap[r.room_id] = r.name || r.room_id; });
        result.activeRooms = roomIds.map((roomId) => ({ roomId, name: nameMap[roomId] || roomId, count: roomCounts[roomId] }))
          .sort((a, b) => b.count - a.count);
      }

      const resWallets = await supabaseAdmin.from('wallets').select('balance');
      const walletsList = Array.isArray(resWallets.data) ? resWallets.data : [];
      const balances = walletsList.map((w: { balance?: number }) => Number(w.balance) || 0);
      const ranges = [
        { label: '0', min: 0, max: 0 },
        { label: '1 - 1 000', min: 1, max: 1000 },
        { label: '1 001 - 5 000', min: 1001, max: 5000 },
        { label: '5 001 - 20 000', min: 5001, max: 20000 },
        { label: '20 001+', min: 20001, max: 1e9 },
      ];
      result.balanceDistribution = ranges.map((r) => ({
        range: r.label,
        count: balances.filter((b) => b >= r.min && b <= r.max).length,
      }));
    } else {
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
      const regRows = await query(
        `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY DATE(created_at) ORDER BY d`,
        [periodDays]
      ).catch(() => []);
      result.registrations = Array.isArray(regRows)
        ? (regRows as { d: string; c: number }[]).map((r) => ({ date: r.d, count: r.c }))
        : [];

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
      const r = Array.isArray(balanceRows) && balanceRows.length > 0 ? balanceRows[0] as any : {};
      result.balanceDistribution = [
        { range: '0', count: Number(r.r0) || 0 },
        { range: '1 - 1 000', count: Number(r.r1) || 0 },
        { range: '1 001 - 5 000', count: Number(r.r2) || 0 },
        { range: '5 001 - 20 000', count: Number(r.r3) || 0 },
        { range: '20 001+', count: Number(r.r4) || 0 },
      ];
    }
  } catch (err: any) {
    console.error('Erreur admin stats/advanced (données partielles):', err);
    // On garde result tel quel (déjà initialisé à vide ou partiellement rempli)
  }

  return NextResponse.json({ success: true, data: result, period });
}
