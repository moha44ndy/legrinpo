import type { ChatMessage } from '@/hooks/useChat';

export interface ChatRoomCacheEntry {
  roomId: string;
  messages: ChatMessage[];
  at: number;
}

const CHAT_CACHE_TTL_MS = 60 * 1000; // 1 minute

let chatRoomsCache: Record<string, ChatRoomCacheEntry> = {};

export function getChatRoomCache(roomId: string): ChatRoomCacheEntry | null {
  if (!roomId) return null;
  const entry = chatRoomsCache[roomId];
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.at > CHAT_CACHE_TTL_MS) {
    delete chatRoomsCache[roomId];
    return null;
  }
  return entry;
}

export function setChatRoomCache(roomId: string, messages: ChatMessage[], at: number = Date.now()): void {
  if (!roomId) return;
  chatRoomsCache[roomId] = { roomId, messages, at };
}

export function invalidateChatRoomCache(roomId: string): void {
  if (!roomId) return;
  delete chatRoomsCache[roomId];
}

