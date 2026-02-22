// Utilitaires pour le stockage local (localStorage)

export function simpleEncrypt(text: string): string {
  if (!text || typeof window === 'undefined') return '';
  try {
    return btoa(unescape(encodeURIComponent(text + 'GroupePolitique2024')));
  } catch {
    return '';
  }
}

export function simpleDecrypt(encrypted: string): string {
  if (!encrypted || typeof window === 'undefined') return '';
  try {
    const decoded = decodeURIComponent(escape(atob(encrypted)));
    return decoded.replace('GroupePolitique2024', '');
  } catch {
    return encrypted;
  }
}

export interface RoomHistoryItem {
  id: string;
  name: string;
  password?: string | null;
  type: 'private' | 'public';
  createdAt?: string;
  joinedAt?: string;
  isArtist?: boolean;
  description?: string;
  categoryId?: string;
}

export interface RoomHistory {
  created: RoomHistoryItem[];
  joined: RoomHistoryItem[];
}

export function loadHistory(): RoomHistory {
  if (typeof window === 'undefined') return { created: [], joined: [] };
  
  try {
    const created = JSON.parse(
      localStorage.getItem('group_created_discussions') || '[]'
    );
    const joined = JSON.parse(
      localStorage.getItem('group_joined_discussions') || '[]'
    );

    return {
      created: created.map((room: any) => ({
        ...room,
        password: room.password ? simpleDecrypt(room.password) : null,
      })),
      joined: joined.map((room: any) => ({
        ...room,
        password: room.password ? simpleDecrypt(room.password) : null,
      })),
    };
  } catch {
    return { created: [], joined: [] };
  }
}

export function saveHistory(history: RoomHistory): void {
  if (typeof window === 'undefined') return;
  
  try {
    const encryptedCreated = history.created.map((room) => ({
      ...room,
      password: room.password ? simpleEncrypt(room.password) : null,
    }));
    
    const encryptedJoined = history.joined.map((room) => ({
      ...room,
      password: room.password ? simpleEncrypt(room.password) : null,
    }));
    
    localStorage.setItem('group_created_discussions', JSON.stringify(encryptedCreated));
    localStorage.setItem('group_joined_discussions', JSON.stringify(encryptedJoined));
  } catch {
    // Ignore errors
  }
}

