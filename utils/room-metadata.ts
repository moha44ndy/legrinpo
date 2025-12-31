/**
 * Utilitaires pour enregistrer les métadonnées des groupes
 */

import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Enregistre les métadonnées d'un groupe pour le système de bonus mensuel
 * @param roomId - L'ID du groupe
 * @param creatorId - L'ID du créateur
 * @param type - Type de groupe ('private' | 'public')
 */
export async function registerRoomMetadata(
  roomId: string,
  creatorId: string,
  type: 'private' | 'public' = 'private'
): Promise<void> {
  try {
    // Ignorer les groupes publics (ils n'ont pas de bonus mensuel)
    if (roomId.startsWith('public_') || type === 'public') {
      return;
    }

    if (!db) {
      console.warn('Firestore n\'est pas initialisé, impossible d\'enregistrer les métadonnées');
      return;
    }

    const roomMetadataRef = doc(db, 'rooms_metadata', roomId);
    await setDoc(roomMetadataRef, {
      roomId,
      createdBy: creatorId,
      createdAt: serverTimestamp(),
      type,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des métadonnées du groupe:', error);
    // Ne pas faire échouer l'opération si l'enregistrement des métadonnées échoue
  }
}

