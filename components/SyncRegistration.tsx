'use client'

import { useEffect } from 'react'

const PERIODIC_SYNC_TAG = 'legrinpo-periodic-refresh'
const MIN_INTERVAL_SECONDS = 24 * 60 * 60 // 24 h

/**
 * Enregistre le periodic sync au chargement (rafraîchissement des caches en arrière-plan).
 * Ne s'affiche pas à l'écran.
 */
export function SyncRegistration() {
  useEffect(() => {
    async function register() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.ready
      const r = reg as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } }
      if (!r.periodicSync) return
      try {
        await r.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: MIN_INTERVAL_SECONDS })
      } catch {
        // Non supporté ou refusé (ex. Safari, Firefox)
      }
    }
    register()
  }, [])
  return null
}
