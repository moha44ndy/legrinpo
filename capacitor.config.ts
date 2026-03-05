import type { CapacitorConfig } from '@capacitor/cli';

const productionUrl = process.env.PRODUCTION_WEB_URL ?? 'https://www.legrinpo.com';

const config: CapacitorConfig = {
  appId: 'com.legrinpo.app',
  appName: 'Legrinpo',
  webDir: 'cap-web',
  // En CI (Codemagic) : PRODUCTION_WEB_URL défini → l’app charge le site en prod dans le WebView
  server: productionUrl
    ? {
        url: productionUrl,
        // Garder la navigation sur le même domaine dans l’app (éviter d’ouvrir Safari)
        allowNavigation: ['legrinpo.com', 'www.legrinpo.com'],
      }
    : {},
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
    },
  },
};

export default config;
