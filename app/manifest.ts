import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Legrinpo - Discussions',
    short_name: 'Legrinpo',
    description: 'Plateforme de discussion et de coordination en temps réel - Legrinpo',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e27',
    theme_color: '#1a237e',
    orientation: 'portrait',
    scope: '/',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    categories: ['social', 'productivity'],
    lang: 'fr',
  };
}
