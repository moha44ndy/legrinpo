import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** API publique : retourne le code de la pub AdMob pour la page canal (sans auth). */
export async function GET() {
  try {
    const rows = await query('SELECT v FROM settings WHERE k = ?', ['adCanalDiscussion']).catch(() => []);
    const v = Array.isArray(rows) && rows[0] != null ? (rows[0] as { v?: string }).v ?? '' : '';
    return NextResponse.json({ adCanalDiscussion: String(v ?? '').trim() });
  } catch (e) {
    return NextResponse.json({ adCanalDiscussion: '' });
  }
}
