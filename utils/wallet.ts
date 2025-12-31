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

// Constantes de récompenses en FCFA
export const REWARDS = {
  COMMENT_SENT: 0,        // Pas de récompense pour l'envoi de commentaire (selon les spécifications)
};

// Montants des réactions en FCFA
export const REACTION_VALUES: { [emoji: string]: number } = {
  '❤️': 0.01,    // +0.01 FCFA
  '🔥': 0.02,    // +0.02 FCFA
  '😡': -0.005,  // -0.005 FCFA (négatif)
};

// Bonus mensuel pour les créateurs de groupe
export const MONTHLY_BONUS_PER_MEMBER = 0.01; // 0.01 FCFA par membre dans le groupe

/**
 * Initialise ou récupère le portefeuille d'un utilisateur
 */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  if (!db) {
    throw new Error('Firestore n\'est pas initialisé');
  }
  
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
  if (amount <= 0) return;
  if (!db) {
    console.error('Firestore n\'est pas initialisé, impossible d\'ajouter de l\'argent');
    return;
  }
  
  const walletRef = doc(db, 'wallets', userId);
  
  // S'assurer que le portefeuille existe
  await getOrCreateWallet(userId);
  
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
 * Retire de l'argent du portefeuille d'un utilisateur
 */
export async function removeFromWallet(
  userId: string,
  amount: number,
  reason: string,
  roomId?: string,
  messageId?: string
): Promise<void> {
  if (amount <= 0) return;
  if (!db) {
    console.error('Firestore n\'est pas initialisé, impossible de retirer de l\'argent');
    return;
  }
  
  const walletRef = doc(db, 'wallets', userId);
  
  // S'assurer que le portefeuille existe
  const wallet = await getOrCreateWallet(userId);
  
  // Vérifier que le solde est suffisant
  if (wallet.balance < amount) {
    // Si le solde est insuffisant, on met le solde à 0
    await updateDoc(walletRef, {
      balance: -wallet.balance, // On retire tout ce qui reste
      totalSpent: increment(wallet.balance),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Retirer le montant
    await updateDoc(walletRef, {
      balance: increment(-amount),
      totalSpent: increment(amount),
      updatedAt: serverTimestamp(),
    });
  }

  // Créer une transaction
  const transactionRef = doc(db, 'wallets', userId, 'transactions', `${Date.now()}_${Math.random()}`);
  const transaction: Transaction = {
    id: transactionRef.id,
    userId,
    type: 'spend',
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
 * (Désactivé selon les spécifications - pas de récompense pour l'envoi)
 */
export async function rewardForComment(userId: string, roomId: string, messageId: string): Promise<void> {
  // Pas de récompense pour l'envoi de commentaire selon les spécifications
  return;
}

/**
 * Traite une réaction sur un message et met à jour les portefeuilles
 * @param messageOwnerId - L'ID de l'utilisateur qui a envoyé le message
 * @param emoji - L'emoji de la réaction
 * @param roomId - L'ID du salon
 * @param messageId - L'ID du message
 */
export async function processReaction(
  messageOwnerId: string,
  emoji: string,
  roomId: string,
  messageId: string
): Promise<void> {
  const amount = REACTION_VALUES[emoji];
  
  if (amount === undefined) {
    console.warn(`Réaction non reconnue: ${emoji}`);
    return;
  }

  if (amount > 0) {
    // Réaction positive - ajouter de l'argent
    await addToWallet(
      messageOwnerId,
      amount,
      `Réaction ${emoji} reçue`,
      roomId,
      messageId
    );
  } else if (amount < 0) {
    // Réaction négative - retirer de l'argent
    await removeFromWallet(
      messageOwnerId,
      Math.abs(amount),
      `Réaction ${emoji} reçue`,
      roomId,
      messageId
    );
  }
}

/**
 * Retire une réaction et annule son effet sur le portefeuille
 * @param messageOwnerId - L'ID de l'utilisateur qui a envoyé le message
 * @param emoji - L'emoji de la réaction à retirer
 * @param roomId - L'ID du salon
 * @param messageId - L'ID du message
 */
export async function removeReaction(
  messageOwnerId: string,
  emoji: string,
  roomId: string,
  messageId: string
): Promise<void> {
  const amount = REACTION_VALUES[emoji];
  
  if (amount === undefined) {
    console.warn(`Réaction non reconnue: ${emoji}`);
    return;
  }

  // Inverser l'effet de la réaction
  if (amount > 0) {
    // C'était une réaction positive - retirer l'argent
    await removeFromWallet(
      messageOwnerId,
      amount,
      `Réaction ${emoji} retirée`,
      roomId,
      messageId
    );
  } else if (amount < 0) {
    // C'était une réaction négative - rembourser l'argent
    await addToWallet(
      messageOwnerId,
      Math.abs(amount),
      `Réaction ${emoji} retirée`,
      roomId,
      messageId
    );
  }
}

/**
 * Récompense un utilisateur pour les réactions reçues sur un message
 * (Déprécié - utiliser processReaction à la place)
 */
export async function rewardForReactions(
  userId: string,
  reactionCount: number,
  roomId: string,
  messageId: string
): Promise<void> {
  // Cette fonction est dépréciée, utiliser processReaction à la place
  return;
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

/**
 * Calcule et distribue le bonus mensuel aux créateurs de groupes
 * @param roomId - L'ID du salon/groupe
 * @param creatorId - L'ID du créateur du groupe
 * @param memberCount - Le nombre de membres dans le groupe
 */
export async function rewardMonthlyBonus(
  roomId: string,
  creatorId: string,
  memberCount: number
): Promise<void> {
  if (memberCount <= 0) return;
  
  const bonusAmount = memberCount * MONTHLY_BONUS_PER_MEMBER;
  
  await addToWallet(
    creatorId,
    bonusAmount,
    `Bonus mensuel - ${memberCount} membre(s) dans le groupe`,
    roomId
  );
}

