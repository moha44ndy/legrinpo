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
        src: '/logo_legrinpo.jpeg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/logo_legrinpo.jpeg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
    categories: ['social', 'productivity'],
    lang: 'fr',
  };
}
