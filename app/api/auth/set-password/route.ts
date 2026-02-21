import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'auth:set-password', { windowMs: 60 * 1000, max: 5 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
      const [id] = decoded.split(':');
      userId = id;
    } catch {
      return NextResponse.json(
        { error: 'Session invalide' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 401 }
      );
    }

    const user = users[0] as { id: number };
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date().toISOString();
    await query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, updatedAt, user.id]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Set password:', e);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement du mot de passe', details: e?.message },
      { status: 500 }
    );
  }
}
