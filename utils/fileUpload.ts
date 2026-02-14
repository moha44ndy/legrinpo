// Utilitaires pour l'upload de fichiers vers Firebase Storage

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';

export interface FileMetadata {
  url: string;
  name: string;
  type: string;
  size: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB pour les images
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB pour les vidéos
const MAX_AUDIO_SIZE = 5 * 1024 * 1024; // 5 MB pour les notes vocales (environ 1 minute)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB pour la photo de profil

// Types de fichiers autorisés
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

/**
 * Upload un fichier vers Firebase Storage
 */
export async function uploadFile(
  file: File,
  roomId: string,
  userId: string,
  messageId: string
): Promise<FileMetadata> {
  if (!storage) {
    throw new Error('Firebase Storage n\'est pas initialisé');
  }

  // Vérifier la taille du fichier
  const fileType = file.type;
  let maxSize = MAX_FILE_SIZE;

  if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
    maxSize = MAX_IMAGE_SIZE;
  } else if (ALLOWED_VIDEO_TYPES.includes(fileType)) {
    maxSize = MAX_VIDEO_SIZE;
  } else if (ALLOWED_AUDIO_TYPES.includes(fileType)) {
    maxSize = MAX_AUDIO_SIZE;
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(`Le fichier est trop volumineux. Taille maximale : ${maxSizeMB} MB`);
  }

  // Créer le chemin de stockage
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const fileName = `${timestamp}_${file.name}`;
  const storagePath = `chats/${roomId}/messages/${messageId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  // Upload le fichier
  try {
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      url: downloadURL,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'upload du fichier:', error);
    throw new Error(`Erreur lors de l'upload : ${error.message}`);
  }
}

/**
 * Upload une note vocale (audio)
 */
export async function uploadAudio(
  audioBlob: Blob,
  roomId: string,
  userId: string,
  messageId: string
): Promise<FileMetadata> {
  if (!storage) {
    throw new Error('Firebase Storage n\'est pas initialisé');
  }

  // Vérifier la durée (max 1 minute = ~1 MB pour du MP3)
  if (audioBlob.size > MAX_AUDIO_SIZE) {
    throw new Error('La note vocale dépasse 1 minute. Durée maximale : 1 minute');
  }

  const timestamp = Date.now();
  const fileName = `voice_${timestamp}.webm`;
  const storagePath = `chats/${roomId}/messages/${messageId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const snapshot: UploadResult = await uploadBytes(storageRef, audioBlob);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      url: downloadURL,
      name: fileName,
      type: 'audio/webm',
      size: audioBlob.size,
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'upload de la note vocale:', error);
    throw new Error(`Erreur lors de l'upload de la note vocale : ${error.message}`);
  }
}

/**
 * Upload une photo de profil vers Firebase Storage
 * Chemin : profiles/{userId}/avatar_{timestamp}.{ext}
 */
export async function uploadAvatar(file: File, userId: string): Promise<FileMetadata> {
  if (!storage) {
    throw new Error('Firebase Storage n\'est pas initialisé');
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Format non autorisé. Utilisez JPG, PNG, GIF ou WebP.');
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('La photo ne doit pas dépasser 2 Mo.');
  }

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `avatar_${timestamp}.${ext}`;
  const storagePath = `profiles/${userId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      url: downloadURL,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'upload de la photo de profil:', error);
    throw new Error(`Erreur lors de l'upload : ${error.message}`);
  }
}

/**
 * Vérifie si un type de fichier est autorisé
 */
export function isFileTypeAllowed(file: File): boolean {
  const fileType = file.type;
  return (
    ALLOWED_IMAGE_TYPES.includes(fileType) ||
    ALLOWED_VIDEO_TYPES.includes(fileType) ||
    ALLOWED_AUDIO_TYPES.includes(fileType) ||
    ALLOWED_DOCUMENT_TYPES.includes(fileType)
  );
}

/**
 * Obtient le type de média d'un fichier
 */
export function getMediaType(file: File): 'image' | 'video' | 'audio' | 'document' | 'unknown' {
  const fileType = file.type;
  if (ALLOWED_IMAGE_TYPES.includes(fileType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(fileType)) return 'video';
  if (ALLOWED_AUDIO_TYPES.includes(fileType)) return 'audio';
  if (ALLOWED_DOCUMENT_TYPES.includes(fileType)) return 'document';
  return 'unknown';
}

