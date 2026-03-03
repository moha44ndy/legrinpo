// Stub AdMob pour le build web (Next.js / Vercel).
// Sur le web, on ne montre pas de bannières natives via le plugin Capacitor,
// donc on expose juste une API vide compatible avec l'usage dans AdMobBanner.

export enum BannerAdSize {
  ADAPTIVE_BANNER = 'ADAPTIVE_BANNER',
}

export enum BannerAdPosition {
  TOP_CENTER = 'TOP_CENTER',
  BOTTOM_CENTER = 'BOTTOM_CENTER',
}

export const AdMob = {
  async initialize() {
    return
  },
  async trackingAuthorizationStatus() {
    return { status: 'authorized' }
  },
  async requestTrackingAuthorization() {
    return { status: 'authorized' }
  },
  async showBanner(_opts: { adId: string; adSize: BannerAdSize; position: BannerAdPosition; margin?: number }) {
    return
  },
  async removeBanner() {
    return
  },
}

