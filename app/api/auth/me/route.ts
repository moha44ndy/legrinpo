import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Décoder le token (simple pour l'instant)
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
      const [userId] = decoded.split(':');

      // Récupérer l'utilisateur
      const users = await query(
        'SELECT id, uid, email, username, display_name, avatar, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      );

      if (!Array.isArray(users) || users.length === 0) {
        return NextResponse.json(
          { error: 'Utilisateur non trouvé' },
          { status: 401 }
        );
      }

      const user = users[0];

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatar: user.avatar || undefined,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'utilisateur', details: error.message },
      { status: 500 }
    );
  }
}

