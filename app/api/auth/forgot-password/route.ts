import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    const users = await query('SELECT id, email FROM users WHERE email = ?', [email]);
    const userExists = Array.isArray(users) && users.length > 0;

    // Toujours renvoyer le même message pour ne pas révéler si l'email existe
    const successMessage = 'Si un compte existe avec cette adresse, vous recevrez un lien pour réinitialiser votre mot de passe.';

    if (!userExists) {
      return NextResponse.json({ success: true, message: successMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const { supabaseAdmin } = await import('@/lib/supabase');
    if (supabaseAdmin) {
      await supabaseAdmin.from('password_reset_tokens').insert({
        email,
        token,
        expires_at: expiresAt.toISOString(),
      });
    }

    const origin = request.headers.get('origin') || request.headers.get('x-forwarded-host') || '';
    const baseUrl = origin ? `${origin.startsWith('http') ? origin : `https://${origin}`}` : APP_URL;
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        connectionTimeout: 10000,
      });
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Bonjour,\n\nPour réinitialiser votre mot de passe, cliquez sur le lien ci-dessous (valable ${TOKEN_EXPIRY_HOURS} h) :\n\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<p>Bonjour,</p><p>Pour réinitialiser votre mot de passe, <a href="${resetLink}">cliquez ici</a> (lien valable ${TOKEN_EXPIRY_HOURS} h).</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      });
    }

    return NextResponse.json({ success: true, message: successMessage });
  } catch (err: unknown) {
    console.error('Forgot password:', err);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessayez plus tard.' },
      { status: 500 }
    );
  }
}
