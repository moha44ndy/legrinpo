import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MODERATION_EMAIL =
  process.env.MODERATION_NOTIFICATION_EMAIL ||
  process.env.HELP_NOTIFICATION_EMAIL ||
  process.env.WITHDRAW_NOTIFICATION_EMAIL ||
  process.env.ADMIN_EMAIL;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'report-message', { windowMs: 60 * 1000, max: 20 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
      { status: 429, headers: rateLimit.retryAfterMs ? { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } : {} }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { roomId, messageId, messageText, authorId, authorName } = body;

    if (!roomId || !messageId) {
      return NextResponse.json({ error: 'Données manquantes pour le signalement.' }, { status: 400 });
    }

    const lines = [
      'Nouveau signalement de message',
      '---',
      `Salle (roomId) : ${String(roomId)}`,
      `Message ID : ${String(messageId)}`,
      authorId ? `Auteur (userId) : ${String(authorId)}` : 'Auteur (userId) : (inconnu)',
      authorName ? `Pseudo de l\'auteur : ${String(authorName)}` : 'Pseudo de l\'auteur : (inconnu)',
      '---',
      'Contenu du message :',
      '',
      typeof messageText === 'string' && messageText.trim() ? messageText.trim() : '(texte vide ou uniquement pièces jointes)',
    ];

    const text = lines.join('\n');

    const html = [
      '<h2>Nouveau signalement de message</h2>',
      `<p><strong>Salle (roomId) :</strong> ${escapeHtml(String(roomId))}</p>`,
      `<p><strong>Message ID :</strong> ${escapeHtml(String(messageId))}</p>`,
      `<p><strong>Auteur (userId) :</strong> ${escapeHtml(authorId ? String(authorId) : '(inconnu)')}</p>`,
      `<p><strong>Pseudo de l'auteur :</strong> ${escapeHtml(authorName || '(inconnu)')}</p>`,
      '<hr>',
      '<p><strong>Contenu du message :</strong></p>',
      `<pre style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">${escapeHtml(
        typeof messageText === 'string' && messageText.trim() ? messageText.trim() : '(texte vide ou uniquement pièces jointes)'
      )}</pre>`,
    ].join('\n');

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      logger.warn('Moderation: SMTP non configuré', { roomId, messageId });
      return NextResponse.json({
        success: true,
        message: 'Signalement enregistré. Configurez SMTP pour recevoir les signalements par email.',
      });
    }

    if (!MODERATION_EMAIL) {
      logger.warn('Moderation: MODERATION_NOTIFICATION_EMAIL non configuré');
      return NextResponse.json(
        { error: 'Réception des signalements non configurée côté serveur.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: MODERATION_EMAIL,
      subject: `[Moderation] Signalement message ${String(messageId)} (room ${String(roomId)})`,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Erreur API signalement message', { err: error?.message });
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du signalement.' },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

