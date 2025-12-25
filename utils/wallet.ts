// Utilitaires pour le système de portefeuille

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

export interface Wallet {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: any;
  updatedAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'earn' | 'spend';
  amount: number;
  reason: string;
  timestamp: any;
  roomId?: string;
  messageId?: string;
}

// Constantes de récompenses
export const REWARDS = {
  COMMENT_SENT: 5,        // 5 points pour chaque commentaire envoyé
  REACTION_RECEIVED: 2,    // 2 points par réaction reçue
  COMMENT_LIKED: 3,        // 3 points supplémentaires si le commentaire est liké
};

/**
 * Initialise ou récupère le portefeuille d'un utilisateur
 */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const walletRef = doc(db, 'wallets', userId);
  const walletSnap = await getDoc(walletRef);

  if (walletSnap.exists()) {
    return walletSnap.data() as Wallet;
  } else {
    // Créer un nouveau portefeuille
    const newWallet: Wallet = {
      userId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(walletRef, newWallet);
    return newWallet;
  }
}

/**
 * Ajoute de l'argent au portefeuille d'un utilisateur
 */
export async function addToWallet(
  userId: string,
  amount: number,
  reason: string,
  roomId?: string,
  messageId?: string
): Promise<void> {
  const walletRef = doc(db, 'wallets', userId);
  
  // Mettre à jour le portefeuille
  await updateDoc(walletRef, {
    balance: increment(amount),
    totalEarned: increment(amount),
    updatedAt: serverTimestamp(),
  });

  // Créer une transaction
  const transactionRef = doc(db, 'wallets', userId, 'transactions', `${Date.now()}_${Math.random()}`);
  const transaction: Transaction = {
    id: transactionRef.id,
    userId,
    type: 'earn',
    amount,
    reason,
    timestamp: serverTimestamp(),
    roomId,
    messageId,
  };
  await setDoc(transactionRef, transaction);
}

/**
 * Récompense un utilisateur pour avoir envoyé un commentaire
 */
export async function rewardForComment(userId: string, roomId: string, messageId: string): Promise<void> {
  await addToWallet(
    userId,
    REWARDS.COMMENT_SENT,
    'Commentaire envoyé',
    roomId,
    messageId
  );
}

/**
 * Récompense un utilisateur pour les réactions reçues sur un message
 */
export async function rewardForReactions(
  userId: string,
  reactionCount: number,
  roomId: string,
  messageId: string
): Promise<void> {
  if (reactionCount > 0) {
    const totalReward = reactionCount * REWARDS.REACTION_RECEIVED;
    await addToWallet(
      userId,
      totalReward,
      `${reactionCount} réaction(s) reçue(s)`,
      roomId,
      messageId
    );
  }
}

/**
 * Récupère le solde actuel d'un utilisateur
 */
export async function getBalance(userId: string): Promise<number> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance;
}

/**
 * Récupère l'historique des transactions d'un utilisateur
 */
export async function getTransactionHistory(userId: string, limitCount: number = 50): Promise<Transaction[]> {
  // Cette fonction nécessiterait une collection de transactions
  // Pour l'instant, on retourne un tableau vide
  // À implémenter avec une query Firestore
  return [];
}

