import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Legrinpo - Discussions',
    short_name: 'Legrinpo',
    description: 'Plateforme de discussion et de coordination en temps réel - Legrinpo',
    start_url: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'tabbed', 'browser'] as MetadataRoute.Manifest['display_override'],
    // Partage système : l’app reçoit titre, texte et URL via l’action (ex. /?title=...&text=...&url=...)
    share_target: {
      action: '/',
      method: 'get',
      params: [
        { name: 'title', value: 'title' },
        { name: 'text', value: 'text' },
        { name: 'url', value: 'url' },
      ],
    },
    dir: 'ltr',
    background_color: '#0a0e27',
    theme_color: '#1a237e',
    orientation: 'portrait',
    scope: '/',
    // PWA Builder : domaines additionnels (sous-domaines, etc.). Vide = uniquement cette origine.
    scope_extensions: [],
    // Ouverture de fichiers par l’app (optionnel). Vide = pas de types gérés pour l’instant.
    file_handlers: [],
    // Protocoles (mailto:, sms:, web+…). Vide = aucun pour l’instant.
    protocol_handlers: [],
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
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Screenshots : sizes doit correspondre aux dimensions réelles des images.
    screenshots: [
      {
        src: '/screenshots/app.png',
        sizes: '1280x720',
        type: 'image/png',
      },
      // Capture mobile (form_factor narrow). Utiliser app-mobile.png si tu as une vraie capture portrait.
      {
        src: '/screenshots/app-mobile.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
      } as { src: string; sizes?: string; type?: string },
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
    } as MetadataRoute.Manifest['launch_handler'],
    categories: ['social', 'productivity'],
    lang: 'fr',
    // Edge : épingler l’app dans la barre latérale (non typé par Next)
    edge_side_panel: { preferred_width: 400 },
  } as MetadataRoute.Manifest & { scope_extensions: unknown[]; edge_side_panel?: { preferred_width?: number } };
}
