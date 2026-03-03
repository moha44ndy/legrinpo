import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

async function getCurrentUserIdFromCookie(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    const idNum = parseInt(userId, 10);
    return Number.isNaN(idNum) ? null : idNum;
  } catch {
    return null;
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    try {
      await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
    } catch {
      // Table transactions optionnelle
    }
    try {
      await query('DELETE FROM wallets WHERE user_id = ?', [userId]);
    } catch {
      // Table wallets optionnelle
    }

    await query('DELETE FROM users WHERE id = ?', [userId]);

    const cookieStore = await cookies();
    cookieStore.delete('session_token');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur suppression de compte:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte', details: error?.message },
      { status: 500 }
    );
  }
}

