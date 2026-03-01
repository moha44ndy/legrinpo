import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Legrinpo - Discussions',
    short_name: 'Legrinpo',
    description: 'Plateforme de discussion et de coordination en temps réel - Legrinpo',
    start_url: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    // Partage système : l’app reçoit titre, texte et URL via l’action (ex. /?title=...&text=...&url=...)
    share_target: {
      action: '/',
      method: 'get',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
    dir: 'ltr',
    background_color: '#0a0e27',
    theme_color: '#1a237e',
    orientation: 'portrait',
    scope: '/',
    // Autres origines autorisées (ex. sous-domaines). Vide = uniquement cette origine.
    scope_extensions: [] as { origin: string; type: string }[],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Screenshots pour les stores (PWA Builder). Ajouter des PNG 1280x720+ dans public/screenshots/
    screenshots: [
      {
        src: '/screenshots/app.png',
        sizes: '1280x720',
        type: 'image/png',
        label: 'Legrinpo - Discussions',
      },
    ],
    prefer_related_applications: false,
    related_applications: [],
    // Âge cible (stores) : obtenir un certificat IARC sur https://www.globalratings.com/
    // puis ajouter ici : iarc_rating_id: 'votre-uuid-iacr',
    shortcuts: [
      { name: 'Accueil', short_name: 'Accueil', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }] },
      { name: 'Canaux de discussion', short_name: 'Canaux', url: '/canaldiscussion', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }] },
      { name: 'Chat', short_name: 'Chat', url: '/chat', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }] },
    ],
    launch_handler: {
      client_mode: 'focus-existing',
    } as { platform?: string; url?: string; client_mode?: string },
    categories: ['social', 'productivity'],
    lang: 'fr',
  };
}
