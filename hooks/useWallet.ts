'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getOrCreateWallet, getBalance, Wallet } from '@/utils/wallet';

const BALANCE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const balanceCache: { [userId: string]: { balance: number; wallet: Wallet | null; at: number } } = {};

function getCachedBalance(userId: string): { balance: number; wallet: Wallet | null } | null {
  const entry = balanceCache[userId];
  if (!entry || Date.now() - entry.at > BALANCE_CACHE_TTL_MS) return null;
  return { balance: entry.balance, wallet: entry.wallet };
}

function setCachedBalance(userId: string, balance: number, wallet: Wallet | null) {
  balanceCache[userId] = { balance, wallet, at: Date.now() };
}

export function useWallet(userId: string) {
  const cached = userId ? getCachedBalance(userId) : null;
  const [wallet, setWallet] = useState<Wallet | null>(cached?.wallet ?? null);
  const [balance, setBalance] = useState<number>(cached?.balance ?? 0);
  const [loading, setLoading] = useState(!cached);
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
        if (!getCachedBalance(currentUserId)) setLoading(true);
        setError(null);
        const walletData = await getOrCreateWallet(currentUserId);
        if (cancelled) return;
        const bal = walletData.balance || 0;
        setWallet(walletData);
        setBalance(bal);
        setCachedBalance(currentUserId, bal, walletData);
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
            setCachedBalance(currentUserId, w.balance, w);
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
      const nextWallet = wallet ? { ...wallet, balance: newBalance } : null;
      if (nextWallet) setWallet(nextWallet);
      setCachedBalance(userId, newBalance, nextWallet);
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

