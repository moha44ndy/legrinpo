import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { checkRateLimit } from '@/lib/rate-limit';
import { logLogin } from '@/lib/admin-logger';
import { logger } from '@/lib/logger';
import { db } from '@/lib/firebase';
import { supabaseAdmin } from '@/lib/supabase';
import { getDemoCredentials, isDemoLoginEnabled } from '@/lib/demo-account';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ error: 'Connexion démo désactivée.' }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, 'auth:demo-login', { windowMs: 60 * 1000, max: 10 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur manquante.' }, { status: 500 });
  }

  const { email } = getDemoCredentials();

  try {
    const { data: userRow, error } = await supabaseAdmin
      .from('users')
      .select('id, uid, email, username, display_name, avatar, is_admin, is_disabled')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      logger.error('demo-login: erreur Supabase', { err: error.message });
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json(
        {
          error:
            'Compte démo introuvable. Exécutez : npm run create-demo-user',
        },
        { status: 404 }
      );
    }

    if (userRow.is_disabled) {
      return NextResponse.json({ error: 'Compte démo désactivé.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from('users')
      .update({ terms_accepted_at: now, updated_at: now })
      .eq('id', userRow.id);

    const sessionToken = Buffer.from(`${userRow.id}:${Date.now()}`).toString('base64');
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    if (db && userRow.uid) {
      try {
        const walletRef = doc(db, 'wallets', userRow.uid);
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) {
          await setDoc(walletRef, {
            userId: userRow.uid,
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (firestoreError: unknown) {
        const msg = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
        logger.error('demo-login: wallet Firestore', { uid: userRow.uid, err: msg });
      }
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    logLogin({ userId: userRow.id, email: userRow.email, ip }).catch(() => {});

    return NextResponse.json({
      success: true,
      user: {
        id: userRow.id,
        uid: userRow.uid,
        email: userRow.email,
        username: userRow.username,
        displayName: userRow.display_name,
        avatar: userRow.avatar || undefined,
        isAdmin: !!userRow.is_admin,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    logger.error('demo-login', { err: message });
    return NextResponse.json({ error: 'Erreur lors de la connexion démo.' }, { status: 500 });
  }
}
