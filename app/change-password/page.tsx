'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconWallet } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import '../globals.css';
import '../login/login.css';
import '../reset-password/reset-password.css';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
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

  if (authLoading || !user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Paramètres</h1>
            <p>Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Changer mon mot de passe</h1>
          <p>Indiquez votre mot de passe actuel puis le nouveau (au moins 6 caractères)</p>
        </div>

        {done ? (
          <div className="forgot-done">
            <p className="forgot-done-text">Votre mot de passe a été mis à jour.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="current">Mot de passe actuel</label>
              <input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new">Nouveau mot de passe</label>
              <input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link href="/canaldiscussion" className="auth-link">Retour à l&apos;accueil</Link>
            <span className="auth-sep">|</span>
            <Link href="/forgot-password" className="auth-link">Mot de passe oublié</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
