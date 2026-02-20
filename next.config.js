/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// PWA (service worker) — optionnel : npm install @ducanh2912/next-pwa
let withPWA = (config) => config
try {
  withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
  })
} catch (_) {}

module.exports = withPWA(nextConfig)

