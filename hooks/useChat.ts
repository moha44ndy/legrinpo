'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  increment,
} from 'firebase/firestore';

export interface RoomMember {
  userId: string;
  username: string;
}

import { rewardForComment, processReaction, removeReaction } from '@/utils/wallet';
import { registerRoomMetadata } from '@/utils/room-metadata';

export interface FileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface FileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  username: string;
  userId: string;
  timestamp: Date;
  edited?: boolean;
  isArtist?: boolean;
  avatar?: string; // URL de la photo de profil de l'expéditeur
  reactions?: { [userId: string]: string }; // userId -> emoji
  reactionCount?: number;
  attachments?: FileAttachment[]; // Images, vidéos, fichiers
  audio?: FileAttachment; // Note vocale
}

interface UseChatOptions {
  roomId: string;
  roomPassword?: string;
  username: string;
  userId: string;
  userAvatar?: string; // Photo de profil pour les nouveaux messages
  isPrivateRoom: boolean;
}

export function useChat({
  roomId,
  roomPassword,
  username,
  userId,
  userAvatar,
  isPrivateRoom,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'connecting' | 'offline' | 'removed'>('connecting');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [roomCreatorId, setRoomCreatorId] = useState<string | null>(null);
  const [removedUserIds, setRemovedUserIds] = useState<string[]>([]);
  const [roomMembers, setRoomMembers] = useState<Record<string, { username: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCreator = !!roomId && !!userId && roomCreatorId === userId;
  const isRemovedFromGroup = removedUserIds.includes(userId);
  const members: RoomMember[] = useMemo(() => {
    return Object.entries(roomMembers)
      .filter(([id]) => !removedUserIds.includes(id))
      .map(([uid, data]) => ({ userId: uid, username: data?.username || 'Anonyme' }));
  }, [roomMembers, removedUserIds]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  useEffect(() => {
    let unsubscribeMessages: (() => void) | null = null;
    let unsubscribeRoom: (() => void) | null = null;

    const init = async () => {
      try {
        setConnectionStatus('connecting');

        // Vérifier le mot de passe si c'est un salon privé
        if (isPrivateRoom && roomPassword) {
          if (!db) {
            setConnectionStatus('offline');
            return;
          }
          
          const roomRef = doc(db, 'chats', roomId, 'room_info', 'settings');
          const roomDoc = await getDoc(roomRef);

          if (roomDoc.exists()) {
            const roomData = roomDoc.data();
            if (roomData.password !== roomPassword) {
              setConnectionStatus('offline');
              return;
            }
            const removed = roomData.removedUserIds || [];
            setRoomCreatorId(roomData.createdBy || null);
            setRemovedUserIds(removed);
            setRoomMembers(roomData.members || {});
            if (removed.includes(userId)) {
              setConnectionStatus('removed');
              return;
            }
            setPasswordVerified(true);
            // Ajouter l'utilisateur actuel à la liste des membres s'il n'y est pas déjà
            await updateDoc(roomRef, {
              [`members.${userId}`]: { username, joinedAt: serverTimestamp() },
            });
          } else {
            // Créer le salon avec le mot de passe et ajouter le créateur comme premier membre
            await setDoc(roomRef, {
              password: roomPassword,
              createdAt: serverTimestamp(),
              createdBy: userId,
              roomType: 'private',
              removedUserIds: [],
              members: { [userId]: { username, joinedAt: serverTimestamp() } },
            });
            
            // Enregistrer les métadonnées du groupe pour le bonus mensuel
            await registerRoomMetadata(roomId, userId, 'private');
            
            setRoomCreatorId(userId);
            setRemovedUserIds([]);
            setRoomMembers({ [userId]: { username } });
            setPasswordVerified(true);
          }
        } else if (!isPrivateRoom) {
          setPasswordVerified(true);
        }

        if (!passwordVerified && isPrivateRoom) {
          return;
        }

        if (!db) {
          setConnectionStatus('offline');
          return;
        }

        // Écouter les paramètres du groupe (créateur, exclus) pour les salons privés
        if (isPrivateRoom) {
          const roomRef = doc(db, 'chats', roomId, 'room_info', 'settings');
          unsubscribeRoom = onSnapshot(roomRef, (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setRoomCreatorId(d.createdBy || null);
              const removed = d.removedUserIds || [];
              setRemovedUserIds(removed);
              setRoomMembers(d.members || {});
              if (removed.includes(userId)) setConnectionStatus('removed');
            }
          });
        }

        // Écouter les messages
        if (!db) {
          setConnectionStatus('offline');
          setIsConnected(false);
          return;
        }
        
        const messagesRef = collection(db, 'chats', roomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

        unsubscribeMessages = onSnapshot(
          q,
          (snapshot) => {
            const newMessages: ChatMessage[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              const reactions = data.reactions || {};
              const reactionCount = Object.keys(reactions).length;
              
              newMessages.push({
                id: doc.id,
                text: data.text || '',
                username: data.username || 'Anonyme',
                userId: data.userId || '',
                timestamp: data.timestamp?.toDate() || new Date(),
                edited: data.edited || false,
                isArtist: data.isArtist || false,
                reactions,
                reactionCount,
                attachments: data.attachments || undefined,
                audio: data.audio || undefined,
              });
            });
            setMessages(newMessages);
            setIsConnected(true);
            setConnectionStatus('online');
            
            // Scroll en bas après un court délai pour laisser le DOM se mettre à jour
            setTimeout(() => {
              scrollToBottomInstant();
            }, 100);
          },
          (error) => {
            console.error('Erreur lors de l\'écoute des messages:', error);
            setConnectionStatus('offline');
            setIsConnected(false);
          }
        );
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        setConnectionStatus('offline');
        setIsConnected(false);
      }
    };

    init();

    return () => {
      unsubscribeMessages?.();
      unsubscribeRoom?.();
    };
  }, [roomId, roomPassword, isPrivateRoom, userId, passwordVerified, scrollToBottomInstant]);

  const sendMessage = useCallback(
    async (
      text: string,
      attachments?: FileAttachment[],
      audio?: FileAttachment
    ) => {
      // Le message doit avoir au moins du texte, des pièces jointes ou un audio
      if ((!text.trim() && (!attachments || attachments.length === 0) && !audio) || !isConnected) return;
      if (!db) return;

      try {
        const messagesRef = collection(db, 'chats', roomId, 'messages');
        const messageData: any = {
          text: text.trim() || '',
          username,
          userId,
          timestamp: serverTimestamp(),
          edited: false,
          reactions: {},
          reactionCount: 0,
        };
        if (userAvatar) {
          messageData.avatar = userAvatar;
        }

        if (attachments && attachments.length > 0) {
          messageData.attachments = attachments;
        }

        if (audio) {
          messageData.audio = audio;
        }

        const docRef = await addDoc(messagesRef, messageData);
        
        // Récompenser l'utilisateur pour avoir envoyé un commentaire
        try {
          await rewardForComment(userId, roomId, docRef.id);
        } catch (rewardError) {
          console.error('Erreur lors de la récompense:', rewardError);
        }
        
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      }
    },
    [roomId, username, userId, userAvatar, isConnected, scrollToBottom]
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim()) return;

      try {
        if (!db) return;
        
        const messageRef = doc(db, 'chats', roomId, 'messages', messageId);
        await updateDoc(messageRef, {
          text: newText.trim(),
          edited: true,
          editedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Erreur lors de la modification du message:', error);
      }
    },
    [roomId]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!db) return;
      
      try {
        const messageRef = doc(db, 'chats', roomId, 'messages', messageId);
        await deleteDoc(messageRef);
      } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
      }
    },
    [roomId]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!db) return;
      
      try {
        const messageRef = doc(db, 'chats', roomId, 'messages', messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (!messageDoc.exists()) {
          console.error('Message introuvable');
          return;
        }

        const messageData = messageDoc.data();
        const reactions = messageData.reactions || {};
        const messageOwnerId = messageData.userId;
        const currentReaction = reactions[userId];

        // Si l'utilisateur a déjà cette réaction, on la retire
        if (currentReaction === emoji) {
          // Retirer la réaction
          const newReactions = { ...reactions };
          delete newReactions[userId];
          
          await updateDoc(messageRef, {
            reactions: newReactions,
            reactionCount: Object.keys(newReactions).length,
          });

          // Annuler l'effet sur le portefeuille
          await removeReaction(messageOwnerId, emoji, roomId, messageId);
        } else {
          // Si l'utilisateur a une autre réaction, on la remplace
          if (currentReaction) {
            // Annuler l'effet de l'ancienne réaction
            await removeReaction(messageOwnerId, currentReaction, roomId, messageId);
          }

          // Ajouter la nouvelle réaction
          const newReactions = { ...reactions, [userId]: emoji };
          
          await updateDoc(messageRef, {
            reactions: newReactions,
            reactionCount: Object.keys(newReactions).length,
          });

          // Appliquer l'effet sur le portefeuille
          await processReaction(messageOwnerId, emoji, roomId, messageId);
        }
      } catch (error) {
        console.error('Erreur lors de la modification de la réaction:', error);
      }
    },
    [roomId, userId]
  );

  const removeMember = useCallback(
    async (memberUserId: string) => {
      if (!db || !roomId || !isPrivateRoom || roomCreatorId !== userId) return;
      if (memberUserId === roomCreatorId) return; // Ne pas retirer le créateur
      try {
        const roomRef = doc(db, 'chats', roomId, 'room_info', 'settings');
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) return;
        const data = roomDoc.data();
        const current = data.removedUserIds || [];
        if (current.includes(memberUserId)) return;
        await updateDoc(roomRef, {
          removedUserIds: [...current, memberUserId],
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Erreur lors du retrait du membre:', error);
      }
    },
    [roomId, isPrivateRoom, roomCreatorId, userId]
  );

  return {
    messages,
    isConnected,
    connectionStatus,
    passwordVerified,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    messagesEndRef,
    scrollToBottom,
    isCreator,
    isRemovedFromGroup,
    roomCreatorId,
    members,
    removeMember,
  };
}

