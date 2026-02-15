import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase';

const WITHDRAW_EMAIL = process.env.WITHDRAW_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';
const MIN_WITHDRAWAL = 5000;

const METHOD_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  mtn_money: 'MTN Money',
  carte_bancaire: 'Compte bancaire',
};

function getMethodLabel(method: string): string {
  return METHOD_LABELS[method] || method;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, userEmail, amount, method, country, phoneOrIban, fullName } = body;

    if (!userId || amount == null || !method || !country?.trim() || !phoneOrIban?.trim() || !fullName?.trim() || !userEmail?.trim()) {
      return NextResponse.json(
        { error: 'Champs requis: userId, amount, method, country, phoneOrIban, fullName, userEmail' },
        { status: 400 }
      );
    }

    const amountNum = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }
    if (amountNum < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `Le retrait minimum est de ${MIN_WITHDRAWAL.toLocaleString()} FCFA` },
        { status: 400 }
      );
    }

    const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId), 10);

    if (supabaseAdmin) {
      await supabaseAdmin.from('withdrawal_requests').insert({
        user_id: userIdNum,
        email: userEmail.trim(),
        username: username || null,
        amount: amountNum,
        method,
        country: (country || '').trim() || null,
        phone_or_iban: (phoneOrIban || '').trim() || null,
        full_name: (fullName || '').trim() || null,
        status: 'pending',
      });
    }

    const methodLabel = getMethodLabel(method);
    const fieldLabel = method === 'carte_bancaire' ? 'IBAN / Compte' : 'Téléphone';

    const countryVal = (country || '').trim();
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const text = [
      'Nouvelle demande de retrait',
      '---',
      `Utilisateur: ${username || userId}`,
      `ID: ${userId}`,
      `Email: ${userEmail}`,
      `Pays: ${countryVal}`,
      `Montant: ${amountNum} FCFA`,
      `Mode: ${methodLabel}`,
      `${fieldLabel}: ${phoneOrIban}`,
      `Nom complet: ${fullName}`,
      '---',
      'Après validation sous 24 h, effectuer le virement et confirmer à l\'utilisateur.',
    ].join('\n');

    const html = `
      <h2>Nouvelle demande de retrait</h2>
      <table style="border-collapse: collapse;">
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Utilisateur</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(username || userId)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>ID</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(userId)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Email</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(userEmail)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Pays</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(countryVal)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Montant</strong></td><td style="padding:6px;border:1px solid #ddd;">${amountNum} FCFA</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Mode</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(methodLabel)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>${escapeHtml(fieldLabel)}</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(phoneOrIban)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #ddd;"><strong>Nom complet</strong></td><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(fullName)}</td></tr>
      </table>
      <p><em>Après validation sous 24 h, effectuer le virement et confirmer à l'utilisateur.</em></p>
    `;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn('Demande de retrait (SMTP non configuré):', { userId, username, userEmail, amount: amountNum, method, phoneOrIban, fullName });
      return NextResponse.json({
        success: true,
        message: 'Demande enregistrée. Configurez SMTP pour recevoir la confirmation par email.',
      });
    }

    if (!WITHDRAW_EMAIL) {
      console.warn('Demande de retrait (WITHDRAW_NOTIFICATION_EMAIL non configuré):', { userId, username, userEmail, amount: amountNum, method, phoneOrIban, fullName });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    if (WITHDRAW_EMAIL) {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: WITHDRAW_EMAIL,
        subject: `[Retrait] ${fullName} - ${amountNum} FCFA`,
        text,
        html,
      });
    }

    const userConfirmText = [
      'Bonjour,',
      '',
      'Nous avons bien pris votre demande de retrait en compte.',
      '',
      `Montant : ${amountNum} FCFA`,
      `Mode : ${methodLabel}`,
      '',
      'Après validation sous 24 h, l\'argent vous sera envoyé.',
      '',
      'Cordialement,',
      'L\'équipe',
    ].join('\n');

    const userConfirmHtml = `
      <p>Bonjour,</p>
      <p>Nous avons bien pris votre demande de retrait en compte.</p>
      <p><strong>Montant :</strong> ${amountNum} FCFA<br><strong>Mode :</strong> ${methodLabel}</p>
      <p>Après validation sous 24 h, l'argent vous sera envoyé.</p>
      <p>Cordialement,<br>L'équipe</p>
    `;

    await transporter.sendMail({
      from: SMTP_FROM,
      to: userEmail,
      subject: 'Demande de retrait bien reçue',
      text: userConfirmText,
      html: userConfirmHtml,
    });

    return NextResponse.json({ success: true, message: 'Demande envoyée. Vous serez crédité sous 24 h après validation.' });
  } catch (err: any) {
    console.error('Erreur API withdraw:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur lors de l\'envoi de la demande' },
      { status: 500 }
    );
  }
}
