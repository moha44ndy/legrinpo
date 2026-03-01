import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.legrinpo.app',
  appName: 'Legrinpo',
  webDir: 'cap-web',
  // En CI (Codemagic) : PRODUCTION_WEB_URL défini → l’app charge le site en prod dans le WebView
  server:
    process.env.PRODUCTION_WEB_URL ?
      { url: process.env.PRODUCTION_WEB_URL } :
      {},
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
    },
  },
};

export default config;
