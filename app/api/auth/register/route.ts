import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'auth:register', { windowMs: 60 * 1000, max: 5 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives d\'inscription. Réessayez dans quelques minutes.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }
  try {
    const body = await request.json();
    const { email, password, username } = body;

    // Validations
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom d\'utilisateur sont requis' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' },
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (Array.isArray(existingEmail) && existingEmail.length > 0) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé' },
        { status: 400 }
      );
    }

    // Vérifier si le nom d'utilisateur existe déjà
    const existingUsername = await query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (Array.isArray(existingUsername) && existingUsername.length > 0) {
      return NextResponse.json(
        { error: 'Ce nom d\'utilisateur est déjà utilisé' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Générer un UID unique
    const uid = randomUUID();

    // Créer l'utilisateur
    const result = await query(
      `INSERT INTO users (uid, email, username, display_name, password_hash) 
       VALUES (?, ?, ?, ?, ?)`,
      [uid, email, username, username, passwordHash]
    );

    const userId = (result as any).insertId;

    // Créer le portefeuille pour l'utilisateur
    await query(
      `INSERT INTO wallets (user_id, balance, total_earned) 
       VALUES (?, 0, 0)`,
      [userId]
    );

    // Créer le portefeuille dans Firestore avec l'uid comme clé
    if (db) {
      try {
        const walletRef = doc(db, 'wallets', uid);
        await setDoc(walletRef, {
          userId: uid,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (firestoreError: any) {
        logger.error('Erreur création portefeuille Firestore', { uid, err: firestoreError?.message });
        // Ne pas bloquer l'inscription si Firestore échoue
      }
    }

    // Retourner les informations de l'utilisateur (sans le mot de passe)
    const user = await query(
      'SELECT id, uid, email, username, display_name, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    const userData = Array.isArray(user) && user.length > 0 ? user[0] : null;
    
    if (!userData) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération de l\'utilisateur créé' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        uid: userData.uid,
        email: userData.email,
        username: userData.username,
        displayName: userData.display_name,
        avatar: userData.avatar || undefined,
      },
    });
  } catch (error: any) {
    logger.error('Erreur inscription', { err: error?.message });
    return NextResponse.json(
      { error: 'Erreur lors de l\'inscription', details: error.message },
      { status: 500 }
    );
  }
}

