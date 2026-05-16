'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconWallet } from '@/components/Icons';
import '../globals.css';
import './login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();
  const showDemoLogin = process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/canaldiscussion');
    } catch (error: any) {
      let errorMessage = 'Erreur lors de la connexion';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Aucun compte trouvé avec cet email';
          break;
        case 'auth/invalid-credentials':
          errorMessage = 'Email / nom d\'utilisateur ou mot de passe incorrect';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Mot de passe incorrect';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email invalide';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Ce compte a été désactivé';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Trop de tentatives. Réessayez plus tard';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Connexion démo impossible.');
        return;
      }
      window.location.href = '/canaldiscussion';
    } catch {
      setError('Erreur de connexion démo.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1><IconWallet size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Connexion</h1>
          <p>Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email ou nom d&apos;utilisateur</label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email ou pseudo"
              required
              disabled={loading || demoLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading || demoLoading}
            />
            <p className="auth-forgot-wrap">
              <Link href="/forgot-password" className="auth-link auth-forgot-link">Mot de passe oublié ?</Link>
            </p>
          </div>

          <button type="submit" className="auth-button" disabled={loading || demoLoading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          {showDemoLogin && (
            <button
              type="button"
              className="auth-button auth-button-demo"
              onClick={handleDemoLogin}
              disabled={loading || demoLoading}
            >
              {demoLoading ? 'Connexion démo...' : 'Compte démo (review)'}
            </button>
          )}
        </form>

        <div className="auth-footer">
          <p>
            Pas encore de compte ?{' '}
            <Link href="/register" className="auth-link">S&apos;inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
