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

  return (
    <div className="app-loading-screen">
      <div className="app-loading-inner">
        <div className="app-loading-logo">
          <img src="/logo_legrinpo.jpeg" alt="Legrinpo" />
        </div>
        <div className="app-loading-title">Legrinpo</div>
      </div>
    </div>
  );
}

