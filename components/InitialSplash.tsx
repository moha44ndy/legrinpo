'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoading } from './AppLoading';

export function InitialSplash() {
  const { loading } = useAuth();
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.sessionStorage.getItem('legrinpoInitialSplashDone');
  });

  useEffect(() => {
    if (!visible) return;
    if (!loading) {
      const timeout = setTimeout(() => {
        setVisible(false);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('legrinpoInitialSplashDone', '1');
        }
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [loading, visible]);

  if (!visible) return null;

  return (
    <div className="app-splash-overlay">
      <AppLoading />
    </div>
  );
}

