'use client';

import { useEffect } from 'react';

/**
 * En mode app native (Capacitor iOS/Android), ajoute la classe "native-app" sur <html>
 * pour que le CSS puisse adapter les safe areas (ex. header chat sous la Dynamic Island).
 */
export function CapacitorBodyClass() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (Cap?.isNativePlatform?.()) {
      document.documentElement.classList.add('native-app');
    }
  }, []);
  return null;
}
