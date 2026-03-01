'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function HelpPage() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', message: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.subject.trim()) {
      setError('Veuillez choisir un sujet.');
      return;
    }
    if (!form.message.trim()) {
      setError('Veuillez décrire votre demande.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id ?? '',
          username: user?.username ?? '',
          userEmail: (user as { email?: string })?.email ?? '',
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi.");
        return;
      }
      setSent(true);
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="help-page">
      <div className="help-page-inner">
        <h1>Aide</h1>
        <p className="help-intro">
          Besoin d&apos;aide ? Consultez les informations ci-dessous ou envoyez-nous un message.
        </p>

        <section className="help-section">
          <h2>Comment ça marche</h2>
          <p>
            Legrinpo est une plateforme de discussion et de coordination en temps réel.
            Rejoignez des canaux, participez aux discussions et échangez avec votre groupe.
          </p>
        </section>

        <section className="help-section">
          <h2>Nous contacter</h2>
          {sent ? (
            <div className="help-success">
              <p>Votre message a bien été envoyé. Notre équipe vous répondra dans les plus brefs délais.</p>
            </div>
          ) : (
            <form className="help-form" onSubmit={handleSubmit}>
              <label className="help-form-label">
                Sujet
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                >
                  <option value="">Choisir un sujet</option>
                  <option value="portefeuille">Question sur le portefeuille</option>
                  <option value="retrait">Problème de retrait</option>
                  <option value="technique">Problème technique</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
              <label className="help-form-label">
                Votre message
                <textarea
                  rows={4}
                  placeholder="Décrivez votre question ou problème..."
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </label>
              {error && <div className="help-form-error">{error}</div>}
              <button type="submit" className="help-form-submit" disabled={submitting}>
                {submitting ? 'Envoi en cours…' : 'Envoyer'}
              </button>
            </form>
          )}
        </section>

        <p className="help-back">
          <Link href="/privacy">Politique de confidentialité</Link>
          {' · '}
          <Link href="/canaldiscussion">← Retour aux canaux</Link>
        </p>
      </div>
    </main>
  );
}
