'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import '../globals.css';
import './settings.css';

export default function SettingsPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, updateUserProfile, logout } = useAuth();
  const [editUsernameValue, setEditUsernameValue] = useState('');
  const [usernameEditError, setUsernameEditError] = useState<string | null>(null);
  const [usernameEditSaving, setUsernameEditSaving] = useState(false);

  const username = userProfile?.username || (user as { username?: string })?.username || '';

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    setEditUsernameValue(username);
  }, [username]);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.'
    );
    if (!confirmed) return;
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erreur lors de la suppression du compte.');
        return;
      }
      await logout();
      router.push('/login');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression du compte.');
    }
  };

  const handleLogout = () => {
    if (!window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
    logout().then(() => router.push('/login'));
  };

  if (authLoading || !user) {
    return (
      <main className="help-page settings-page">
        <div className="help-page-inner">
          <p className="settings-back">
            <Link href="/canaldiscussion">← Retour à l&apos;accueil</Link>
          </p>
          <h1>Paramètres</h1>
          <p className="help-intro">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="help-page settings-page">
      <div className="help-page-inner">
        <p className="settings-back">
          <Link href="/canaldiscussion">← Retour à l&apos;accueil</Link>
        </p>
        <h1>Paramètres</h1>
        <p className="help-intro">Gérez votre compte et vos préférences.</p>

        <section className="help-section settings-section">
          <h2>Mon pseudo</h2>
          <div className="settings-username-row">
            <input
              type="text"
              className="settings-username-input"
              value={editUsernameValue}
              onChange={(e) => {
                setEditUsernameValue(e.target.value);
                setUsernameEditError(null);
              }}
              placeholder="Nouveau pseudo (min. 3 caractères)"
              disabled={usernameEditSaving}
              maxLength={50}
              aria-label="Nouveau pseudo"
            />
            <div className="settings-username-actions">
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                onClick={async () => {
                  const val = editUsernameValue.trim();
                  if (val.length < 3) {
                    setUsernameEditError('Au moins 3 caractères.');
                    return;
                  }
                  setUsernameEditError(null);
                  setUsernameEditSaving(true);
                  try {
                    await updateUserProfile({ username: val });
                    setEditUsernameValue(val);
                  } catch (err: unknown) {
                    setUsernameEditError(err instanceof Error ? err.message : 'Erreur.');
                  } finally {
                    setUsernameEditSaving(false);
                  }
                }}
                disabled={usernameEditSaving}
              >
                {usernameEditSaving ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => {
                  setEditUsernameValue(username);
                  setUsernameEditError(null);
                }}
                disabled={usernameEditSaving}
              >
                Annuler
              </button>
            </div>
          </div>
          {usernameEditError && <p className="settings-error">{usernameEditError}</p>}
        </section>

        <section className="help-section settings-section">
          <h2>Compte et aide</h2>
          <ul className="settings-link-list">
            <li>
              <Link href="/change-password" className="settings-link">Changer mon mot de passe</Link>
            </li>
            <li>
              <Link href="/help" className="settings-link">Aide</Link>
            </li>
            <li>
              <Link href="/privacy" className="settings-link">Politique de confidentialité</Link>
            </li>
          </ul>
        </section>

        <section className="help-section settings-section settings-danger">
          <div className="settings-danger-actions">
            <button
              type="button"
              className="settings-btn settings-btn-danger"
              onClick={handleLogout}
            >
              Déconnexion
            </button>
            <button
              type="button"
              className="settings-btn settings-btn-danger"
              onClick={handleDeleteAccount}
            >
              Supprimer mon compte
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
