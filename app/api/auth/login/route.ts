import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logLogin } from '@/lib/admin-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'auth:login', { windowMs: 60 * 1000, max: 15 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validations
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe sont requis' },
        { status: 400 }
      );
    }

    // Trouver l'utilisateur par email (inclure is_admin et is_disabled)
    const users = await query(
      'SELECT id, uid, email, username, display_name, avatar, password_hash, COALESCE(is_admin, 0) AS is_admin, COALESCE(is_disabled, 0) AS is_disabled FROM users WHERE email = ?',
      [email]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const user = users[0] as { id: number; uid: string; email: string; username: string; display_name: string; avatar: string | null; password_hash: string; is_admin: number; is_disabled: number };

    if (user.is_disabled) {
      return NextResponse.json(
        { error: 'Ce compte a été désactivé. Contactez l\'administrateur.' },
        { status: 403 }
      );
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Créer une session (utiliser un token simple pour l'instant)
    // En production, utilisez JWT ou NextAuth.js
    const sessionToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    // Stocker le token dans un cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    // S'assurer que le wallet existe dans Firestore (pour la persistance)
    if (db && user.uid) {
      try {
        const walletRef = doc(db, 'wallets', user.uid);
        const walletSnap = await getDoc(walletRef);
        
        if (!walletSnap.exists()) {
          // Créer le wallet dans Firestore s'il n'existe pas
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
        // Ne pas bloquer la connexion si Firestore échoue
      }
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || null;
    logLogin({ userId: user.id, email: user.email, ip }).catch(() => {});

    // Retourner les informations de l'utilisateur (sans le mot de passe), avec isAdmin
    return NextResponse.json({
      success: true,
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
    logger.error('Erreur connexion', { err: error?.message });
    return NextResponse.json(
      { error: 'Erreur lors de la connexion', details: error.message },
      { status: 500 }
    );
  }
}

