import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isCurrentUserAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

async function getFirebaseRoomsCount(): Promise<number> {
  const db = getAdminFirestore();
  if (!db) return 0;
  try {
    const snapshot = await db.collection('rooms').where('type', '==', 'public').get();
    return snapshot.size;
  } catch {
    return 0;
  }
}

async function getFirebaseWalletsStats(): Promise<{ count: number; totalBalance: number }> {
  const db = getAdminFirestore();
  if (!db) return { count: 0, totalBalance: 0 };
  try {
    const snapshot = await db.collection('wallets').get();
    let totalBalance = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalBalance += Number(data.balance) || 0;
    });
    return { count: snapshot.size, totalBalance };
  } catch {
    return { count: 0, totalBalance: 0 };
  }
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const [users, transactions, roomsSql, roomsFirebase, firebaseWallets] = await Promise.all([
      safeQueryCount('users'),
      safeQueryCount('transactions'),
      safeQueryCount('rooms').catch(() => 0),
      getFirebaseRoomsCount(),
      getFirebaseWalletsStats(),
    ]);

    // Utiliser Firebase pour le nombre de salons si Admin est configuré, sinon fallback SQL
    const firestoreConfigured = getAdminFirestore() != null;
    const rooms = firestoreConfigured ? roomsFirebase : roomsSql;
    const wallets = firebaseWallets.count > 0 ? firebaseWallets.count : (await safeQueryCount('wallets'));
    const totalBalance = firebaseWallets.totalBalance > 0 || firebaseWallets.count > 0
      ? firebaseWallets.totalBalance
      : (await safeQuerySum('wallets', 'balance'));
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
