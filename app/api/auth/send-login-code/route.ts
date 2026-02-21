import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import nodemailer from 'nodemailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';

const CODE_EXPIRY_MINUTES = 15;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'auth:send-login-code', { windowMs: 60 * 1000, max: 5 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une minute.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }

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
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Aucun compte avec cette adresse email.' },
        { status: 404 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    if (supabaseAdmin) {
      await supabaseAdmin.from('login_codes').delete().eq('email', email);
      await supabaseAdmin.from('login_codes').insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: 'Configuration serveur manquante' },
        { status: 500 }
      );
    }

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
        subject: 'Votre code de connexion',
        text: `Bonjour,\n\nVotre code de connexion est : ${code}\n\nIl est valable ${CODE_EXPIRY_MINUTES} minutes. Ne le partagez avec personne.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<p>Bonjour,</p><p>Votre code de connexion est : <strong>${code}</strong></p><p>Il est valable ${CODE_EXPIRY_MINUTES} minutes. Ne le partagez avec personne.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Un code de connexion a été envoyé à ${email}. Il est valable ${CODE_EXPIRY_MINUTES} minutes.`,
    });
  } catch (err: unknown) {
    console.error('Send login code:', err);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessayez plus tard.' },
      { status: 500 }
    );
  }
}
