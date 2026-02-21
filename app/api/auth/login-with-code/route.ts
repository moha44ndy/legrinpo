import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logLogin } from '@/lib/admin-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'auth:login', { windowMs: 60 * 1000, max: 15 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim().replace(/\s/g, '') : '';

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email et code requis' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Configuration serveur manquante' },
        { status: 500 }
      );
    }

    const { data: rows } = await supabaseAdmin
      .from('login_codes')
      .select('email, code')
      .eq('email', email)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    const valid = Array.isArray(rows) && rows.length > 0;
    if (!valid) {
      return NextResponse.json(
        { error: 'Code invalide ou expiré. Demandez un nouveau code.' },
        { status: 401 }
      );
    }

    await supabaseAdmin.from('login_codes').delete().eq('email', email).eq('code', code);

    const users = await query(
      'SELECT id, uid, email, username, display_name, avatar, COALESCE(is_admin, 0) AS is_admin, COALESCE(is_disabled, 0) AS is_disabled FROM users WHERE email = ?',
      [email]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Compte introuvable.' },
        { status: 401 }
      );
    }

    const user = users[0] as { id: number; uid: string; email: string; username: string; display_name: string; avatar: string | null; is_admin: number; is_disabled: number };

    if (user.is_disabled) {
      return NextResponse.json(
        { error: 'Ce compte a été désactivé. Contactez l\'administrateur.' },
        { status: 403 }
      );
    }

    const sessionToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    if (db && user.uid) {
      try {
        const walletRef = doc(db, 'wallets', user.uid);
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) {
          await setDoc(walletRef, {
            userId: user.uid,
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (firestoreError: any) {
        logger.error('Erreur vérification/création portefeuille Firestore', { uid: user.uid, err: firestoreError?.message });
      }
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
    logLogin({ userId: user.id, email: user.email, ip }).catch(() => {});

    return NextResponse.json({
      success: true,
      mustSetPassword: true,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar || undefined,
        isAdmin: !!user.is_admin,
      },
    });
  } catch (error: any) {
    logger.error('Erreur login-with-code', { err: error?.message });
    return NextResponse.json(
      { error: 'Erreur lors de la connexion', details: error.message },
      { status: 500 }
    );
  }
}
