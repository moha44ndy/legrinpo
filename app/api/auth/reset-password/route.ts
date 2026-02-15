import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!token) {
      return NextResponse.json(
        { error: 'Lien invalide ou expiré' },
        { status: 400 }
      );
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
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
      .from('password_reset_tokens')
      .select('email')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    const email = rows?.[0] ? (rows[0] as { email: string }).email : null;

    if (!email) {
      return NextResponse.json(
        { error: 'Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email);
    if (updateError) {
      console.error('Reset password update:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du mot de passe' },
        { status: 500 }
      );
    }
    await supabaseAdmin.from('password_reset_tokens').delete().eq('token', token);

    return NextResponse.json({
      success: true,
      message: 'Mot de passe mis à jour. Vous pouvez vous connecter.',
    });
  } catch (err: unknown) {
    console.error('Reset password:', err);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessayez plus tard.' },
      { status: 500 }
    );
  }
}
