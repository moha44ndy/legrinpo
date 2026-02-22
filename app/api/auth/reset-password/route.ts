import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim().replace(/\s/g, '') : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: 'Code requis. Vérifiez l\'email reçu (mot de passe oublié).' },
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
      .eq('email', email)
      .eq('token', code)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    const found = rows?.[0] ? (rows[0] as { email: string }).email : null;

    if (!found) {
      return NextResponse.json(
        { error: 'Code invalide ou expiré. Demandez un nouveau code depuis « Mot de passe oublié ».' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email)
      .select('id');
    if (updateError) {
      console.error('Reset password update:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du mot de passe' },
        { status: 500 }
      );
    }
    if (!updatedRows?.length) {
      return NextResponse.json(
        { error: 'Compte introuvable pour cet email. Vérifiez l\'adresse ou réessayez.' },
        { status: 400 }
      );
    }
    await supabaseAdmin.from('password_reset_tokens').delete().eq('email', email).eq('token', code);

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
