'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getOrCreateWallet, getBalance, Wallet } from '@/utils/wallet';

export function useWallet(userId: string) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const currentUserId = userId;

    const loadWallet = async () => {
      try {
        setLoading(true);
        setError(null);
        const walletData = await getOrCreateWallet(currentUserId);
        if (cancelled) return;
        setWallet(walletData);
        setBalance(walletData.balance || 0);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Erreur chargement du portefeuille:', err);
        setError(err?.message || 'Impossible de charger le portefeuille');
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!db || cancelled) return;
      const walletRef = doc(db, 'wallets', currentUserId);
      unsubscribe = onSnapshot(
        walletRef,
        (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            const data = snap.data();
            const w: Wallet = {
              userId: data.userId || currentUserId,
              balance: data.balance ?? 0,
              totalEarned: data.totalEarned ?? 0,
              totalSpent: data.totalSpent ?? 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
            setWallet(w);
            setBalance(w.balance);
          }
        },
        (err) => {
          if (!cancelled) console.error('useWallet onSnapshot error:', err);
        }
      );
    };

    loadWallet();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const refreshBalance = async () => {
    if (!userId) return;
    try {
      const newBalance = await getBalance(userId);
      setBalance(newBalance);
      if (wallet) {
        setWallet({ ...wallet, balance: newBalance });
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour du solde:', err);
    }
  };

  return {
    wallet,
    balance,
    loading,
    error,
    refreshBalance,
  };
}

