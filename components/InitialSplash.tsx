'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoading } from './AppLoading';

export function InitialSplash() {
  const { loading } = useAuth();
  const pathname = usePathname();

  // Par défaut, on ne montre rien côté serveur pour éviter les flashes.
  const [visible, setVisible] = useState(false);

  // Décider si on doit afficher le splash (une seule fois, sur la toute
  // première visite de la route '/').
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alreadyDone = window.sessionStorage.getItem('legrinpoInitialSplashDone') === '1';
    if (alreadyDone) return;
    if (pathname !== '/') return;

    // Première visite de '/', on affiche le logo.
    setVisible(true);
  }, [pathname]);

  // Une fois l'auth chargée, on laisse le logo quelques millisecondes puis
  // on le cache définitivement pour cette session.
  useEffect(() => {
    if (!visible) return;
    if (loading) return;

    const timeout = setTimeout(() => {
      setVisible(false);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('legrinpoInitialSplashDone', '1');
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [loading, visible]);

  if (!visible) return null;

  return (
    <div className="app-splash-overlay">
      <AppLoading />
    </div>
  );
}


