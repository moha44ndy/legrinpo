'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface TermsAcceptanceGateProps {
  children: React.ReactNode;
}

export function TermsAcceptanceGate({ children }: TermsAcceptanceGateProps) {
  const [status, setStatus] = useState<'loading' | 'pending' | 'accepted'>('loading');
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkTerms = useCallback(async () => {
    try {
      const res = await fetch('/api/user/terms');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.accepted) {
        setStatus('accepted');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('pending');
    }
  }, []);

  useEffect(() => {
    checkTerms();
  }, [checkTerms]);

  const handleAccept = async () => {
    if (!agreed) {
      setError('Veuillez cocher la case pour accepter les conditions.');
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Impossible d\'enregistrer votre acceptation.');
        return;
      }
      setStatus('accepted');
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setAccepting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="terms-gate-loading" aria-busy="true">
        <p>Chargement…</p>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="terms-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <div className="terms-gate-modal">
          <h2 id="terms-gate-title">Conditions d&apos;utilisation</h2>
          <p>
            Avant d&apos;accéder aux discussions et aux contenus publiés par la communauté, vous devez lire et
            accepter nos conditions d&apos;utilisation.
          </p>
          <ul className="terms-gate-list">
            <li>Pas de contenu haineux, violent, illégal ou harcelant</li>
            <li>Respect de la vie privée et des autres membres</li>
            <li>Signalement et blocage disponibles dans le chat</li>
          </ul>
          <p>
            <Link href="/terms" className="terms-gate-link" target="_blank">
              Lire les conditions complètes
            </Link>
          </p>
          <label className="terms-gate-checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setError(null);
              }}
            />
            <span>J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité</span>
          </label>
          {error && <p className="terms-gate-error">{error}</p>}
          <button
            type="button"
            className="terms-gate-accept-btn"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? 'Enregistrement…' : 'Accepter et continuer'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
