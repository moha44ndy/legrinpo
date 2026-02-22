export const ROOMS_CACHE_TTL_MS = 60 * 1000; // 1 min pour limiter les lectures Firestore

export interface MappedRoom {
  id: string;
  roomId: string;
  name: string;
  description: string;
  type: string;
  createdAt: string;
  categoryId?: string;
}

let roomsCache: { rooms: MappedRoom[]; at: number } | null = null;

export function invalidateRoomsCache(): void {
  roomsCache = null;
}

export function getRoomsCache(): { rooms: MappedRoom[]; at: number } | null {
  return roomsCache;
}

export function setRoomsCache(rooms: MappedRoom[], at: number): void {
  roomsCache = { rooms, at };
}
