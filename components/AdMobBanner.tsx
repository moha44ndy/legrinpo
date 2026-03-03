'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// iOS — Section 1 : bannière en haut (ad-bar)
const ADMOB_BANNER_ID_IOS = 'ca-app-pub-7440739960679215/6963684238';
// iOS — Section 2 : bannière native « comme bulle catégorie » (page canal)
const ADMOB_NATIVE_BANNER_ID_IOS = 'ca-app-pub-7440739960679215/6574324508';
// Android — Section 1 : bannière
const ADMOB_BANNER_ID_ANDROID = 'ca-app-pub-7440739960679215/6580540859';
// Android — Section 2 : format natif avancé (page canal)
const ADMOB_NATIVE_BANNER_ID_ANDROID = 'ca-app-pub-7440739960679215/5041750985';

export function AdMobBanner() {
  const pathname = usePathname();
  const currentAdIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    if (!Cap?.isNativePlatform?.()) return;

    const platform = Cap.getPlatform?.() ?? 'ios';
    const isCanalPage = pathname === '/canaldiscussion';
    const adId =
      platform === 'android'
        ? isCanalPage
          ? ADMOB_NATIVE_BANNER_ID_ANDROID
          : ADMOB_BANNER_ID_ANDROID
        : isCanalPage
          ? ADMOB_NATIVE_BANNER_ID_IOS
          : ADMOB_BANNER_ID_IOS;

    let mounted = true;
    (async () => {
      try {
        const admob = await import('@capacitor-community/admob');
        await admob.AdMob.initialize();

        if (platform === 'ios') {
          try {
            const trackingInfo = await admob.AdMob.trackingAuthorizationStatus();
            if ((trackingInfo as any)?.status === 'notDetermined') {
              await admob.AdMob.requestTrackingAuthorization();
            }
          } catch {
            // Si ATT échoue, on continue avec des pubs non personnalisées
          }
        }
        if (!mounted) return;
        await admob.AdMob.removeBanner().catch(() => {});
        if (!mounted) return;
        currentAdIdRef.current = adId;
        await admob.AdMob.showBanner({
          adId,
          adSize: admob.BannerAdSize.ADAPTIVE_BANNER,
          position: admob.BannerAdPosition.TOP_CENTER,
          margin: 0,
        });
      } catch (e) {
        if (mounted) console.warn('[AdMob]', e);
      }
    })();
    return () => {
      mounted = false;
      import('@capacitor-community/admob').then(({ AdMob }) => AdMob.removeBanner().catch(() => {}));
      currentAdIdRef.current = null;
    };
  }, [pathname]);

  return null;
}
