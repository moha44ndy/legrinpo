import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

const HELP_EMAIL = process.env.HELP_NOTIFICATION_EMAIL || process.env.WITHDRAW_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';

const SUBJECT_LABELS: Record<string, string> = {
  portefeuille: 'Question sur le portefeuille',
  retrait: 'Problème de retrait',
  technique: 'Problème technique',
  autre: 'Autre',
};

function getSubjectLabel(value: string): string {
  return SUBJECT_LABELS[value] || value;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { subject, message, username, userEmail } = body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ error: 'Sujet requis.' }, { status: 400 });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message requis.' }, { status: 400 });
    }

    const subjectLabel = getSubjectLabel(subject.trim());
    const senderEmail = typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim() : '(non renseigné)';
    const senderName = typeof username === 'string' && username.trim() ? username.trim() : '(anonyme)';

    const text = [
      'Nouvelle demande d\'aide',
      '---',
      `Email de la personne : ${senderEmail}`,
      `Pseudo : ${senderName}`,
      `Sujet : ${subjectLabel}`,
      '---',
      'Message :',
      '',
      message.trim(),
    ].join('\n');

    const html = [
      '<h2>Nouvelle demande d\'aide</h2>',
      '<p><strong>Email de la personne :</strong> <a href="mailto:' + senderEmail + '">' + escapeHtml(senderEmail) + '</a></p>',
      '<p><strong>Pseudo :</strong> ' + escapeHtml(senderName) + '</p>',
      '<p><strong>Sujet :</strong> ' + escapeHtml(subjectLabel) + '</p>',
      '<hr>',
      '<p><strong>Message :</strong></p>',
      '<pre style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">' + escapeHtml(message.trim()) + '</pre>',
    ].join('\n');

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn('[Aide] SMTP non configuré. Demande non envoyée par email:', { subject: subjectLabel, senderEmail, senderName });
      return NextResponse.json({
        success: true,
        message: 'Demande enregistrée. Configurez SMTP pour recevoir les demandes par email.',
      });
    }

    if (!HELP_EMAIL) {
      console.warn('[Aide] HELP_NOTIFICATION_EMAIL (ou WITHDRAW_NOTIFICATION_EMAIL / ADMIN_EMAIL) non configuré.');
      return NextResponse.json(
        { error: 'Réception des demandes d\'aide non configurée côté serveur.' },
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
      to: HELP_EMAIL,
      replyTo: senderEmail !== '(non renseigné)' ? senderEmail : undefined,
      subject: `[Aide] ${subjectLabel} - ${senderName} (${senderEmail})`,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur API aide:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de votre demande.' },
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
