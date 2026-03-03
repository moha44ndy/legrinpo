'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SwipeBack() {
  const router = useRouter();

  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

      // Geste démarré depuis le bord gauche (comme sur iOS)
      if (touch.clientX > 40) return;

      tracking = true;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Glissement vers la droite suffisamment prononcé, sans trop de mouvement vertical
      if (deltaX > 70 && Math.abs(deltaY) < 80) {
        if (window.history.length > 1) {
          router.back();
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [router]);

  return null;
}

