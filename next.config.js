const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/manifest.json', destination: '/manifest.webmanifest' },
    ]
  },
  webpack(config) {
    // Dans tous les builds (dev, prod, server, client), on remplace
    // le plugin natif AdMob par un stub web pour éviter les erreurs
    // "module not found" dans Next.js.
    config.resolve.alias['@capacitor-community/admob'] = path.resolve(
      __dirname,
      'stubs/admob-web-stub.ts',
    )
    return config
  },
}

// PWA (service worker) — optionnel : npm install @ducanh2912/next-pwa
let withPWA = (config) => config
try {
  withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    cacheOnFrontendNav: true,
    cacheStartUrl: true,
    reloadOnOnline: true,
    fallbacks: {
      document: '/~offline',
    },
    extendDefaultRuntimeCaching: true,
    workboxOptions: {
      runtimeCaching: [
        {
          urlPattern: ({ sameOrigin, url }) => sameOrigin && (url.pathname === '/' || url.pathname.startsWith('/canaldiscussion') || url.pathname.startsWith('/chat') || url.pathname.startsWith('/login')),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'legrinpo-pages',
            expiration: { maxEntries: 16, maxAgeSeconds: 24 * 60 * 60 },
            networkTimeoutSeconds: 5,
          },
        },
      ],
    },
  })
} catch (_) {}

module.exports = withPWA(nextConfig)

