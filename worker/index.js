/**
 * Custom worker injecté par next-pwa.
 * - Background Sync : rejoue les requêtes en file (IndexedDB) quand le réseau revient.
 * - Periodic Sync : rafraîchit les caches en arrière-plan.
 */

const DB_NAME = 'legrinpo-sync-db'
const STORE_NAME = 'sync-queue'
const SYNC_TAG = 'legrinpo-sync'
const PERIODIC_SYNC_TAG = 'legrinpo-periodic-refresh'

function openDB() {
  return new Promise((resolve, reject) => {
    const r = self.indexedDB.open(DB_NAME, 1)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => resolve(r.result)
    r.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
    }
  })
}

function getQueue(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly')
    const req = t.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

function clearQueue(db, ids) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite')
    const store = t.objectStore(STORE_NAME)
    ids.forEach((id) => store.delete(id))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

async function replayQueue() {
  const db = await openDB()
  const items = await getQueue(db)
  if (items.length === 0) {
    db.close()
    return
  }
  const done = []
  for (const item of items) {
    try {
      const opts = {
        method: item.method || 'GET',
        headers: item.headers || {},
        credentials: 'same-origin',
      }
      if (item.body && (item.method === 'POST' || item.method === 'PUT' || item.method === 'PATCH')) {
        opts.body = item.body
      }
      const res = await self.fetch(item.url, opts)
      if (res.ok || res.status < 500) done.push(item.id)
    } catch (_) {
      // Garder en file pour un prochain sync
    }
  }
  if (done.length) await clearQueue(db, done)
  db.close()
}

async function periodicRefresh() {
  try {
    const cacheNames = await self.caches.keys()
    const pageCache = cacheNames.find((n) => n.includes('legrinpo-pages') || n === 'pages')
    if (pageCache) {
      const cache = await self.caches.open(pageCache)
      await cache.add('/')
    }
  } catch (_) {
    // Ignorer les erreurs en arrière-plan
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueue())
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(periodicRefresh())
  }
})
