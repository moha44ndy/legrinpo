'use client'

import { useEffect } from 'react'

/**
 * Enregistre explicitement le service worker PWA (généré par next-pwa au build).
 * Permet à PWA Builder et aux outils d’audit de détecter la présence d’un SW,
 * et assure l’enregistrement même si l’injection next-pwa est en retard.
 */
export function PwaSwRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const path = '/sw.js'
    navigator.serviceWorker
      .register(path, { scope: '/' })
      .then((reg) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PWA] Service worker enregistré:', reg.scope)
        }
      })
      .catch((err) => {
        // En dev, next-pwa désactive le SW : pas d’erreur affichée
        if (process.env.NODE_ENV === 'production') {
          console.warn('[PWA] Échec enregistrement service worker:', err)
        }
      })
  }, [])
  return null
}
