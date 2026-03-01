/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Pour les outils/stores qui exigent exactement /manifest.json
      { source: '/manifest.json', destination: '/manifest.webmanifest' },
    ]
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

