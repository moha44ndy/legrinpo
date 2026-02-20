import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.legrinpo.app',
  appName: 'Legrinpo',
  webDir: 'cap-web',
  server: {
    // En production : décommentez et mettez l’URL de votre site déployé.
    // L’app ouvrira cette URL dans le WebView au lieu des fichiers locaux.
    // url: 'https://votre-domaine.com',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
    },
  },
};

export default config;
