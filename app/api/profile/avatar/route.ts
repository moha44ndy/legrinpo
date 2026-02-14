/**
 * Upload photo de profil vers Supabase Storage et enregistre l’URL en base.
 * Prérequis : dans Supabase Dashboard > Storage, créer un bucket "avatars" en public.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo
const BUCKET = 'avatars';

export async function POST(request: NextRequest) {
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Stockage Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('avatar') ?? formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Aucun fichier envoyé. Utilisez le champ "avatar" ou "file".' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non autorisé. Utilisez JPG, PNG, GIF ou WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'La photo ne doit pas dépasser 2 Mo.' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/avatar_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('Erreur upload Supabase Storage:', uploadError);
      return NextResponse.json(
        { error: 'Erreur lors de l\'upload. Vérifiez que le bucket "avatars" existe dans Supabase.' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = urlData.publicUrl;

    await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);

    const users = await query(
      'SELECT id, uid, email, username, display_name, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    const user = Array.isArray(users) && users.length > 0 ? users[0] : null;
    if (!user) {
      return NextResponse.json({ success: true, avatar: avatarUrl });
    }

    return NextResponse.json({
      success: true,
      avatar: avatarUrl,
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
    console.error('Erreur API avatar:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload de la photo de profil', details: error.message },
      { status: 500 }
    );
  }
}
