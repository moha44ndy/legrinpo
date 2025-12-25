'use client';

import { useState, useEffect } from 'react';
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

    const loadWallet = async () => {
      try {
        setLoading(true);
        const walletData = await getOrCreateWallet(userId);
        setWallet(walletData);
        setBalance(walletData.balance);
        setError(null);
      } catch (err) {
        console.error('Erreur lors du chargement du portefeuille:', err);
        setError('Impossible de charger le portefeuille');
      } finally {
        setLoading(false);
      }
    };

    loadWallet();

    // Écouter les changements en temps réel
    // TODO: Implémenter avec onSnapshot pour les mises à jour en temps réel
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

