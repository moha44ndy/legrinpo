import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

function toCount(rows: any): number {
  if (!Array.isArray(rows)) return 0;
  if (rows.length === 0) return 0;
  const r = rows[0] as Record<string, unknown>;
  if (r && typeof r.c !== 'undefined') return Number(r.c);
  if (r && typeof (r as any).count !== 'undefined') return Number((r as any).count);
  return rows.length;
}

function toSum(rows: any): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const r = rows[0] as Record<string, unknown>;
  return Number(r?.total ?? 0);
}

async function safeQueryCount(table: string): Promise<number> {
  try {
    const rows = await query(`SELECT COUNT(*) as c FROM ${table}`);
    return toCount(rows);
  } catch {
    return 0;
  }
}

async function safeQuerySum(table: string, column: string): Promise<number> {
  try {
    const rows = await query(`SELECT COALESCE(SUM(${column}), 0) as total FROM ${table}`);
    return toSum(rows);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const [users, wallets, transactions, rooms, totalBalance] = await Promise.all([
      safeQueryCount('users'),
      safeQueryCount('wallets'),
      safeQueryCount('transactions'),
      safeQueryCount('rooms'),
      safeQuerySum('wallets', 'balance'),
    ]);

    const stats = { users, wallets, transactions, rooms, totalBalance };
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Erreur admin stats:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des statistiques', details: error?.message },
      { status: 500 }
    );
  }
}
