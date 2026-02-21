'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IconWallet } from '@/components/Icons';
import '../globals.css';
import '../login/login.css';
import './reset-password.css';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEmail(emailFromUrl);
  }, [emailFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (!email.trim()) {
      setError('Email requis.');
      return;
    }
    if (!code.trim()) {
      setError('Code requis. Utilisez le code reçu par email (page Mot de passe oublié).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), newPassword: password }),
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
          <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Nouveau mot de passe</h1>
          <p>Entrez votre email, le code reçu par email (mot de passe oublié) et choisissez un nouveau mot de passe (au moins 6 caractères).</p>
        </div>

        {done ? (
          <div className="forgot-done">
            <p className="forgot-done-text">Votre mot de passe a été mis à jour. Vous pouvez vous connecter.</p>
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
            <div className="form-group">
              <label htmlFor="code">Code reçu par email</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                disabled={loading}
                className="auth-code-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Nouveau mot de passe</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirmer le mot de passe</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            {done ? (
              <Link href="/login" className="auth-link">Connexion</Link>
            ) : (
              <>
                <Link href="/forgot-password" className="auth-link">Mot de passe oublié</Link>
                <span className="auth-sep">|</span>
                <Link href="/login" className="auth-link">Connexion</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Réinitialisation</h1>
            <p>Chargement...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
