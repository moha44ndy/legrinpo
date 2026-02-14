import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
      userId = decoded.split(':')[0];
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { avatar, displayName, username } = body;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (typeof avatar === 'string') {
      updates.push('avatar = ?');
      values.push(avatar.trim() || null);
    }
    if (typeof displayName === 'string') {
      updates.push('display_name = ?');
      values.push(displayName.trim() || null);
    }
    if (typeof username === 'string' && username.trim().length >= 3) {
      updates.push('username = ?');
      values.push(username.trim());
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée à mettre à jour (avatar, displayName ou username)' },
        { status: 400 }
      );
    }

    values.push(userId);
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const users = await query(
      'SELECT id, uid, email, username, display_name, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
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
  } catch (error: any) {
    console.error('Erreur mise à jour profil:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil', details: error.message },
      { status: 500 }
    );
  }
}
