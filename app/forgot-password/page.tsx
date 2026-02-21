'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconWallet } from '@/components/Icons';
import '../globals.css';
import '../login/login.css';
import './forgot-password.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.');
        return;
      }
      setDone(true);
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Mot de passe oublié</h1>
          <p>Entrez votre email pour recevoir un code de réinitialisation par email</p>
        </div>

        {done ? (
          <div className="forgot-done">
            <p className="forgot-done-text">
              Si un compte existe avec cette adresse, vous recevrez un email avec un code (valable 15 minutes).
            </p>
            <Link href={`/reset-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="auth-button auth-button-block">
              Saisir le code et nouveau mot de passe
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le code'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <button type="button" className="auth-link auth-link-button" onClick={() => router.back()}>
              Retour
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
