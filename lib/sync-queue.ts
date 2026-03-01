/**
 * File de synchronisation en arrière-plan (Background Sync).
 * À appeler quand une requête échoue (ex. envoi de message) pour la rejouer au retour du réseau.
 */

const DB_NAME = 'legrinpo-sync-db'
const STORE_NAME = 'sync-queue'
const SYNC_TAG = 'legrinpo-sync'

export type SyncQueueItem = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => resolve(r.result)
    r.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
    }
  })
}

/**
 * Ajoute une requête à la file et enregistre un sync. Quand le réseau revient, le SW rejouera la requête.
 * À utiliser après un fetch() qui a échoué (réseau coupé).
 */
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    return
  }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite')
    t.objectStore(STORE_NAME).add({
      url: item.url,
      method: item.method || 'GET',
      headers: item.headers || {},
      body: item.body ?? null,
    })
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  db.close()
  const reg = await navigator.serviceWorker.ready
  const regWithSync = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }
  if (regWithSync.sync) await regWithSync.sync.register(SYNC_TAG)
}

/**
 * Indique si Background Sync est disponible (Chrome, Edge, etc.).
 */
export function isBackgroundSyncSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype
}

/**
 * Fetch qui en cas d’échec réseau (offline) met la requête en file pour rejeu au retour du réseau.
 * À utiliser pour les requêtes critiques (ex. formulaire, action importante).
 */
export async function fetchWithSyncFallback(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()
  const url = rawUrl.startsWith('http') ? rawUrl : new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : '').href
  const method = init?.method || 'GET'
  const headers: Record<string, string> = {}
  if (init?.headers) {
    const h = init.headers as Headers
    h.forEach((v, k) => { headers[k] = v })
  }
  let body: string | undefined
  if (init?.body != null) {
    body = typeof init.body === 'string' ? init.body : undefined
  }
  try {
    return await fetch(input, init)
  } catch (err) {
    if (isBackgroundSyncSupported() && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      await addToSyncQueue({ url, method, headers, body })
    }
    throw err
  }
}
