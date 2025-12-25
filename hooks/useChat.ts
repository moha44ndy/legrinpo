'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { rewardForComment, rewardForReactions } from '@/utils/wallet';

export interface ChatMessage {
  id: string;
  text: string;
  username: string;
  userId: string;
  timestamp: Date;
  edited?: boolean;
  isArtist?: boolean;
  reactions?: { [userId: string]: string }; // userId -> emoji
  reactionCount?: number;
}

interface UseChatOptions {
  roomId: string;
  roomPassword?: string;
  username: string;
  userId: string;
  isPrivateRoom: boolean;
}

export function useChat({
  roomId,
  roomPassword,
  username,
  userId,
  isPrivateRoom,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'connecting' | 'offline'>('connecting');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        setConnectionStatus('connecting');

        // Vérifier le mot de passe si c'est un salon privé
        if (isPrivateRoom && roomPassword) {
          const roomRef = doc(db, 'chats', roomId, 'room_info', 'settings');
          const roomDoc = await getDoc(roomRef);

          if (roomDoc.exists()) {
            const roomData = roomDoc.data();
            if (roomData.password !== roomPassword) {
              setConnectionStatus('offline');
              return;
            }
            setPasswordVerified(true);
          } else {
            // Créer le salon avec le mot de passe
            await setDoc(roomRef, {
              password: roomPassword,
              createdAt: serverTimestamp(),
              createdBy: userId,
              roomType: 'private',
            });
            setPasswordVerified(true);
          }
        } else if (!isPrivateRoom) {
          setPasswordVerified(true);
        }

        if (!passwordVerified && isPrivateRoom) {
          return;
        }

        // Écouter les messages
        const messagesRef = collection(db, 'chats', roomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

        unsubscribe = onSnapshot(
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
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [roomId, roomPassword, isPrivateRoom, userId, passwordVerified, scrollToBottomInstant]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !isConnected) return;

      try {
        const messagesRef = collection(db, 'chats', roomId, 'messages');
        const docRef = await addDoc(messagesRef, {
          text: text.trim(),
          username,
          userId,
          timestamp: serverTimestamp(),
          edited: false,
          reactions: {},
          reactionCount: 0,
        });
        
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
    [roomId, username, userId, isConnected, scrollToBottom]
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim()) return;

      try {
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
      try {
        const messageRef = doc(db, 'chats', roomId, 'messages', messageId);
        await deleteDoc(messageRef);
      } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
      }
    },
    [roomId]
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
  };
}

