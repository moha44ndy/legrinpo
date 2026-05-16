'use client';

import { useCallback, useEffect, useState } from 'react';

export function useBlockedUsers(enabled = true) {
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setBlockedUserIds([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/user/blocked');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.blocked)) {
        setBlockedUserIds(data.blocked.map((b: { userId: string }) => b.userId));
      } else {
        setBlockedUserIds([]);
      }
    } catch {
      setBlockedUserIds([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blockUser = useCallback(
    async (blockedUserId: string, blockedUsername: string) => {
      const res = await fetch('/api/user/blocked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId, blockedUsername }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de bloquer cet utilisateur.');
      }
      if (Array.isArray(data.blocked)) {
        setBlockedUserIds(data.blocked.map((b: { userId: string }) => b.userId));
      }
    },
    []
  );

  const unblockUser = useCallback(async (blockedUserId: string) => {
    const res = await fetch(`/api/user/blocked?userId=${encodeURIComponent(blockedUserId)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Impossible de débloquer cet utilisateur.');
    }
    if (Array.isArray(data.blocked)) {
      setBlockedUserIds(data.blocked.map((b: { userId: string }) => b.userId));
    }
  }, []);

  return { blockedUserIds, loading, refresh, blockUser, unblockUser };
}
