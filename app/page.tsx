'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoading } from '@/components/AppLoading';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/canaldiscussion');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Écran de démarrage avec le logo pendant que l'app décide où envoyer l'utilisateur.
  return <AppLoading />;
}

