export interface PublicRoom {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  categoryId?: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  order: number;
}

export const PUBLIC_ROOMS_CACHE_TTL_MS = 60 * 1000; // 1 min

interface PublicRoomsCache {
  rooms: PublicRoom[];
  categories: PublicCategory[];
  at: number;
}

let publicRoomsCache: PublicRoomsCache | null = null;

export function getPublicRoomsCache(): PublicRoomsCache | null {
  return publicRoomsCache;
}

export function setPublicRoomsCache(rooms: PublicRoom[], categories: PublicCategory[], at: number = Date.now()): void {
  publicRoomsCache = { rooms, categories, at };
}

export function invalidatePublicRoomsCache(): void {
  publicRoomsCache = null;
}

export function isPublicRoomsCacheValid(now: number = Date.now()): boolean {
  if (!publicRoomsCache) return false;
  return now - publicRoomsCache.at < PUBLIC_ROOMS_CACHE_TTL_MS;
}

