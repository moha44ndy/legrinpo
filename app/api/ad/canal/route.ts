import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** API publique : retourne le code des pubs pour la page canal (sans auth). */
export async function GET() {
  try {
    const [rowsCanal, rowsNative] = await Promise.all([
      query('SELECT v FROM settings WHERE k = ?', ['adCanalDiscussion']).catch(() => []),
      query('SELECT v FROM settings WHERE k = ?', ['adCanalNative']).catch(() => []),
    ]);
    const vCanal = Array.isArray(rowsCanal) && rowsCanal[0] != null ? (rowsCanal[0] as { v?: string }).v ?? '' : '';
    const vNative = Array.isArray(rowsNative) && rowsNative[0] != null ? (rowsNative[0] as { v?: string }).v ?? '' : '';
    return NextResponse.json({
      adCanalDiscussion: String(vCanal ?? '').trim(),
      adCanalNative: String(vNative ?? '').trim(),
    });
  } catch (e) {
    return NextResponse.json({ adCanalDiscussion: '', adCanalNative: '' });
  }
}
