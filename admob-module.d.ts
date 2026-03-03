declare module '@capacitor-community/admob' {
  export enum BannerAdSize {
    ADAPTIVE_BANNER = 'ADAPTIVE_BANNER',
  }

  export enum BannerAdPosition {
    TOP_CENTER = 'TOP_CENTER',
    BOTTOM_CENTER = 'BOTTOM_CENTER',
  }

  export const AdMob: {
    initialize(): Promise<void>;
    trackingAuthorizationStatus(): Promise<{ status: string }>;
    requestTrackingAuthorization(): Promise<{ status: string }>;
    showBanner(opts: {
      adId: string;
      adSize: BannerAdSize;
      position: BannerAdPosition;
      margin?: number;
    }): Promise<void>;
    removeBanner(): Promise<void>;
  };
}

