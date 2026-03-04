'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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

  // Le visuel de chargement initial est géré globalement par InitialSplash.
  // Ici on n'affiche rien de spécial.
  return null;
}

