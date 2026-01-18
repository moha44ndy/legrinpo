'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, FileAttachment } from '@/hooks/useChat';
import { subscribeToToasts, showToast, closeToast } from '@/utils/toast';
import { ToastContainer, Toast } from '@/components/Toast';
import Wallet from '@/components/Wallet';
import VoiceRecorder, { VoiceRecorderRef } from '@/components/VoiceRecorder';
import { uploadFile, uploadAudio, isFileTypeAllowed, getMediaType } from '@/utils/fileUpload';
import { v4 as uuidv4 } from 'uuid';
import '../globals.css';
import '/css/chat_de_discussion.css';

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const roomId = searchParams.get('room');
  const roomPassword = searchParams.get('password') || undefined;

  const username = userProfile?.username || userProfile?.displayName || user?.displayName || 'Membre';
  // Utiliser uid de userProfile ou user (priorité à uid pour la persistance du wallet)
  // Si pas d'uid, utiliser mysql_id comme fallback, mais éviter les IDs temporaires
  const userId = userProfile?.uid || user?.uid || (user?.id ? `mysql_${user.id}` : null);
  
  // Tous les hooks doivent être déclarés avant tout return conditionnel
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [shouldCancelRecording, setShouldCancelRecording] = useState(false);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const holdStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [clickedMessageId, setClickedMessageId] = useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const voiceRecorderRef = useRef<VoiceRecorderRef>(null);
  
  const isPrivateRoom = !!roomPassword;
  const isPublicRoom = roomId?.startsWith('public_');
  
  // Noms des discussions publiques
  const getPublicRoomName = (roomId: string | null) => {
    if (!roomId) return 'Discussion';
    const roomNames: { [key: string]: string } = {
      'public_aes': 'AES - Alliance des États du Sahel',
      'public_cedeao': 'CEDEAO - Communauté Économique des États de l\'Afrique de l\'Ouest',
      'public_uemoa': 'UEMOA - Union Économique et Monétaire Ouest Africaine',
      'public_autres': 'Globale Organisation'
    };
    return roomNames[roomId] || 'Discussion';
  };

  // useChat doit être appelé avant tout return conditionnel
  const {
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
  } = useChat({
    roomId: roomId || '',
    roomPassword,
    username,
    userId: userId || '', // Passer une chaîne vide si userId est null
    isPrivateRoom,
  });
  
  // Tous les useEffect doivent être appelés avant tout return conditionnel
  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToasts) => {
      setToasts(newToasts);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!roomId) {
      router.push('/canaldiscussion');
    }
  }, [roomId, router]);

  // Fermer le menu contextuel si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (messageMenuRef.current && !messageMenuRef.current.contains(event.target as Node)) {
        setClickedMessageId(null);
        setMessageMenuPosition(null);
      }
    };

    if (clickedMessageId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      // Nettoyer le timer si le composant est démonté
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [clickedMessageId]);
  
  // Si pas de userId valide, ne pas afficher le chat
  if (!userId) {
    return (
      <main className="chat-main-container" style={{ padding: 40, color: '#ffffff', textAlign: 'center', background: '#0a0e27' }}>
        <div className="error-message" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>🔐 Authentification requise</h2>
          <p style={{ margin: '20px 0' }}>
            Vous devez être connecté pour accéder au chat.
          </p>
          <a
            href="/canaldiscussion"
            style={{
              background: '#4a9eff',
              color: '#ffffff',
              padding: '12px 25px',
              borderRadius: '20px',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-block',
              marginTop: '20px',
            }}
          >
            Retour aux Discussions
          </a>
        </div>
      </main>
    );
  }

  const handleSendMessage = async () => {
    // Le message doit avoir au moins du texte, des fichiers ou un audio
    if (!messageInput.trim() && selectedFiles.length === 0 && !recordedAudioBlob && !isRecordingVoice) return;
    if (!roomId || !userId) return;

    setUploading(true);

    try {
      const messageId = uuidv4();
      const attachments: FileAttachment[] = [];
      let audioAttachment: FileAttachment | undefined = undefined;

      // Si l'enregistrement est en cours, l'arrêter et obtenir l'audio
      let audioToUpload = recordedAudioBlob;
      if (isRecordingVoice && voiceRecorderRef.current) {
        audioToUpload = await voiceRecorderRef.current.stopAndGetAudio();
        setIsRecordingVoice(false);
      }

      // Upload de l'audio enregistré
      if (audioToUpload) {
        try {
          const audioMetadata = await uploadAudio(audioToUpload, roomId, userId, messageId);
          audioAttachment = {
            url: audioMetadata.url,
            name: audioMetadata.name,
            type: audioMetadata.type,
            size: audioMetadata.size,
          };
        } catch (error: any) {
          showToast(`Erreur lors de l'upload de la note vocale: ${error.message}`, 'error');
        }
      }

      // Upload des fichiers sélectionnés
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          if (!isFileTypeAllowed(file)) {
            showToast(`Type de fichier non autorisé : ${file.name}`, 'error');
            continue;
          }

          try {
            const metadata = await uploadFile(file, roomId, userId, messageId);
            attachments.push({
              url: metadata.url,
              name: metadata.name,
              type: metadata.type,
              size: metadata.size,
            });
          } catch (error: any) {
            showToast(`Erreur lors de l'upload de ${file.name}: ${error.message}`, 'error');
          }
        }
      }

      // Envoyer le message avec les pièces jointes
      await sendMessage(messageInput.trim(), attachments.length > 0 ? attachments : undefined, audioAttachment);
      
      // Réinitialiser
      setMessageInput('');
      setSelectedFiles([]);
      setIsRecordingVoice(false);
      setRecordedAudioBlob(null);
    } catch (error: any) {
      showToast(`Erreur lors de l'envoi du message: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    files.forEach((file) => {
      if (isFileTypeAllowed(file)) {
        validFiles.push(file);
      } else {
        showToast(`Type de fichier non autorisé : ${file.name}`, 'error');
      }
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    
    // Réinitialiser l'input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    if (!roomId || !userId) return;

    setUploading(true);
    setIsRecordingVoice(false);

    try {
      const messageId = uuidv4();
      const audioMetadata = await uploadAudio(audioBlob, roomId, userId, messageId);
      
      const audioAttachment: FileAttachment = {
        url: audioMetadata.url,
        name: audioMetadata.name,
        type: audioMetadata.type,
        size: audioMetadata.size,
      };

      // Envoyer le message avec la note vocale
      await sendMessage(messageInput.trim(), undefined, audioAttachment);
      
      setMessageInput('');
    } catch (error: any) {
      showToast(`Erreur lors de l'upload de la note vocale: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecordingStop = (audioBlob: Blob | null) => {
    setRecordedAudioBlob(audioBlob);
  };

  const handleVoiceRecordingCancel = () => {
    setIsRecordingVoice(false);
    setRecordedAudioBlob(null);
    setIsHoldingMic(false);
    setShouldCancelRecording(false);
  };

  const handleMicButtonDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isConnected || uploading) return;
    
    e.preventDefault();
    setIsHoldingMic(true);
    setShouldCancelRecording(false);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    holdStartPositionRef.current = { x: clientX, y: clientY };
    
    // Démarrer l'enregistrement
    setIsRecordingVoice(true);
    
    // Ajouter les écouteurs globaux
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalUp);
    document.addEventListener('touchmove', handleGlobalMove, { passive: false });
    document.addEventListener('touchend', handleGlobalUp);
  };

  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isHoldingMic || !holdStartPositionRef.current) return;
    
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY) : e.clientY;
    
    if (clientX === undefined || clientY === undefined) return;
    
    const deltaY = holdStartPositionRef.current.y - clientY;
    const deltaX = Math.abs(holdStartPositionRef.current.x - clientX);
    
    // Si on glisse vers le haut de plus de 50px, annuler
    if (deltaY > 50 || deltaX > 100) {
      setShouldCancelRecording(true);
    } else {
      setShouldCancelRecording(false);
    }
  }, [isHoldingMic]);

  const handleGlobalUp = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isHoldingMic) return;
    
    e.preventDefault();
    
    // Retirer les écouteurs globaux
    document.removeEventListener('mousemove', handleGlobalMove);
    document.removeEventListener('mouseup', handleGlobalUp);
    document.removeEventListener('touchmove', handleGlobalMove);
    document.removeEventListener('touchend', handleGlobalUp);
    
    const shouldCancel = shouldCancelRecording;
    setShouldCancelRecording(false);
    
    if (shouldCancel) {
      // Annuler l'enregistrement complètement
      // On annule d'abord pour démonter le composant, ce qui empêchera le redémarrage
      handleVoiceRecordingCancel();
    } else {
      // Arrêter l'enregistrement mais garder l'audio
      if (voiceRecorderRef.current && voiceRecorderRef.current.isRecording) {
        voiceRecorderRef.current.stopAndGetAudio().then((audioBlob) => {
          if (audioBlob) {
            setRecordedAudioBlob(audioBlob);
          }
          setIsRecordingVoice(false);
          setIsHoldingMic(false);
        });
      } else {
        setIsHoldingMic(false);
      }
    }
    
    holdStartPositionRef.current = null;
  }, [isHoldingMic, handleVoiceRecordingCancel]);

  const handleMicButtonMove = (e: React.MouseEvent | React.TouchEvent) => {
    // Cette fonction est maintenant gérée par handleGlobalMove
  };

  const handleMicButtonUp = (e: React.MouseEvent | React.TouchEvent) => {
    // Cette fonction est maintenant gérée par handleGlobalUp
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Nettoyer les écouteurs globaux au démontage
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalUp);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalUp);
    };
  }, [handleGlobalMove, handleGlobalUp]);

  const handleEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditText(currentText);
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editText.trim()) {
      editMessage(editingMessageId, editText);
      setEditingMessageId(null);
      setEditText('');
    }
  };

  const handleDelete = (messageId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      deleteMessage(messageId);
      setClickedMessageId(null);
      setMessageMenuPosition(null);
    }
  };

  const openMessageMenu = (messageId: string, x: number, y: number) => {
    setClickedMessageId(messageId);
    // Positionner le menu à la position du clic, avec un décalage pour centrer le menu
    const menuWidth = 200; // Largeur approximative du menu
    const adjustedX = Math.max(10, Math.min(x - (menuWidth / 2), window.innerWidth - menuWidth - 10));
    
    setMessageMenuPosition({
      x: adjustedX,
      y: y - 10,
    });
  };

  const handleContextMenu = (messageId: string, event: React.MouseEvent) => {
    // Ne pas ouvrir le menu si on clique sur les boutons de réaction existants
    if ((event.target as HTMLElement).closest('.message-reaction-buttons')) {
      return;
    }
    
    event.preventDefault(); // Empêcher le menu contextuel par défaut du navigateur
    event.stopPropagation();
    
    // Utiliser la position du clic plutôt que le centre du message
    openMessageMenu(messageId, event.clientX, event.clientY);
  };

  const handleTouchStart = (messageId: string, event: React.TouchEvent) => {
    // Ne pas ouvrir le menu si on touche les boutons de réaction existants
    if ((event.target as HTMLElement).closest('.message-reaction-buttons')) {
      return;
    }

    const touch = event.touches[0];
    touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY };

    // Démarrer le timer pour le long press (500ms)
    longPressTimerRef.current = setTimeout(() => {
      // Utiliser la position du touch plutôt que le centre du message
      openMessageMenu(messageId, touch.clientX, touch.clientY);
      
      // Vibrer si supporté (mobile)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    // Annuler le timer si l'utilisateur relève le doigt avant 500ms
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPositionRef.current = null;
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    // Annuler le long press si l'utilisateur bouge trop
    if (touchStartPositionRef.current && longPressTimerRef.current) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPositionRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPositionRef.current.y);
      
      // Si le mouvement est supérieur à 10px, annuler
      if (deltaX > 10 || deltaY > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Texte copié dans le presse-papiers', 'success');
    setClickedMessageId(null);
    setMessageMenuPosition(null);
  };

  const handleReply = (message: any) => {
    // Préremplir le champ de saisie avec une mention
    setMessageInput(`@${message.username} `);
    // Focus sur l'input
    setTimeout(() => {
      const input = document.querySelector('.message-input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
    setClickedMessageId(null);
    setMessageMenuPosition(null);
  };



  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const shouldShowDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    return currentDate !== previousDate;
  };

  const shouldShowMessageHeader = (currentMessage: any, nextMessage: any) => {
    // Toujours afficher le header si c'est le dernier message
    if (!nextMessage) return true;
    // Afficher le header si le message suivant est d'un autre utilisateur
    if (currentMessage.userId !== nextMessage.userId) return true;
    // Afficher le header si le message suivant a une date différente (séparateur de date)
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const nextDate = new Date(nextMessage.timestamp).toDateString();
    if (currentDate !== nextDate) return true;
    // Sinon, ne pas afficher le header
    return false;
  };

  if (!roomId) {
    return null;
  }

  if (isPrivateRoom && !passwordVerified && connectionStatus === 'offline') {
    return (
      <main style={{ padding: 40, color: '#ffffff', textAlign: 'center', background: '#0a0e27' }}>
        <div className="error-message" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>🔐 Accès Refusé</h2>
          <p style={{ margin: '20px 0' }}>
            Le mot de passe pour cette discussion privée est incorrect ou manquant.
          </p>
          <a
            href="/canaldiscussion"
            style={{
              background: '#4a9eff',
              color: '#ffffff',
              padding: '12px 25px',
              borderRadius: '20px',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-block',
              marginTop: '20px',
            }}
          >
            Retour aux Discussions
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-main-container">
      <div className="chat-header-fixed">
        <a href="/canaldiscussion" className="leave-btn">
          ← Retour
        </a>
        <div className="header-content-wrapper">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <div id="statusIndicator" className={`status-indicator ${connectionStatus}`} title={
              connectionStatus === 'online' ? '🟢 Connecté' :
              connectionStatus === 'connecting' ? '🟡 Connexion...' :
              '🔴 Hors ligne'
            } />
            <Wallet userId={userId} username={username} />
          </div>
          <h1>
            {isPublicRoom ? `🌍 ${getPublicRoomName(roomId)}` : isPrivateRoom ? '🔐 Discussion Privée' : '💬 Discussion'}
          </h1>
          <div className="room-info">
            {isPublicRoom ? `Discussion Publique - ${getPublicRoomName(roomId)}` : `Discussion: ${roomId?.substring(0, 20)}...`}
          </div>
          <div className="participants-info">
            {messages.length > 0 && `${new Set(messages.map((m) => m.userId)).size} participant(s)`}
          </div>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-content">
          <div className="messages" id="messages">
            {connectionStatus === 'connecting' ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(74, 158, 255, 0.2)',
                  borderTop: '4px solid #4a9eff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '20px'
                }} />
                <p style={{ marginTop: '20px', fontSize: '1rem' }}>Connexion en cours...</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Chargement des messages...</p>
              </div>
            ) : connectionStatus === 'offline' ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <p style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '10px' }}>🔴 Hors ligne</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Impossible de se connecter au chat</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <p>Aucun message pour le moment.</p>
                <p>Commencez la discussion en envoyant un message !</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.userId === userId;
                const showDate = shouldShowDateSeparator(message, messages[index - 1]);
                const nextMessage = messages[index + 1];
                const showHeader = shouldShowMessageHeader(message, nextMessage);
                const previousMessage = messages[index - 1];
                // Réduire l'espace si le message suivant est de la même personne (même pour le premier message de la série)
                const isConsecutive = nextMessage && nextMessage.userId === message.userId && !shouldShowDateSeparator(nextMessage, message);

                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="date-separator">
                        <div className="date-separator-line" />
                        <div className="date-separator-text">{formatDate(message.timestamp)}</div>
                        <div className="date-separator-line" />
                      </div>
                    )}
                    <div 
                      className={`message ${isOwn ? 'own' : ''} ${message.isArtist ? 'artist' : ''} ${clickedMessageId === message.id ? 'clicked' : ''} ${isConsecutive ? 'consecutive' : ''}`}
                      onContextMenu={(e) => handleContextMenu(message.id, e)}
                      onTouchStart={(e) => handleTouchStart(message.id, e)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      style={{ position: 'relative', userSelect: 'none' }}
                    >
                      <div className={`message-header ${showHeader ? '' : 'message-header-hidden'}`}>
                        <div className="user-avatar">
                          <div className="avatar-initial">
                            {message.username.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="message-details">
                          <div className="username-display">
                            {message.username}
                            {message.isArtist && ' 🎵'}
                          </div>
                        </div>
                      </div>
                      <div className="message-content">
                        <div className="message-bubble">
                          {editingMessageId === message.id ? (
                            <div>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="edit-message-textarea"
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  padding: '8px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: '#ffffff',
                                  border: '1px solid rgba(74, 158, 255, 0.3)',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button
                                  onClick={handleSaveEdit}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#4a9eff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Enregistrer
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditText('');
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Note vocale */}
                              {message.audio && (
                                <div className="audio-attachment" style={{ 
                                  marginBottom: '4px'
                                }}>
                                  <audio 
                                    controls 
                                    style={{ 
                                      width: '100%',
                                      maxWidth: '250px',
                                      height: '32px'
                                    }}
                                  >
                                    <source src={message.audio.url} type={message.audio.type} />
                                    Votre navigateur ne supporte pas l'élément audio.
                                  </audio>
                                </div>
                              )}
                              
                              {/* Pièces jointes (images, vidéos, fichiers) */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="message-attachments" style={{ marginBottom: '8px' }}>
                                  {message.attachments.map((attachment, idx) => {
                                    // Déterminer le type de média basé sur le type MIME
                                    const getAttachmentType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'unknown' => {
                                      if (mimeType.startsWith('image/')) return 'image';
                                      if (mimeType.startsWith('video/')) return 'video';
                                      if (mimeType.startsWith('audio/')) return 'audio';
                                      if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('text')) return 'document';
                                      return 'unknown';
                                    };
                                    const mediaType = getAttachmentType(attachment.type);
                                    
                                    if (mediaType === 'image') {
                                      return (
                                        <div key={idx} style={{ marginBottom: '8px' }}>
                                          <img
                                            src={attachment.url}
                                            alt={attachment.name}
                                            style={{
                                              maxWidth: '100%',
                                              maxHeight: '400px',
                                              borderRadius: '8px',
                                              cursor: 'pointer',
                                            }}
                                            onClick={() => window.open(attachment.url, '_blank')}
                                          />
                                        </div>
                                      );
                                    } else if (mediaType === 'video') {
                                      return (
                                        <div key={idx} style={{ marginBottom: '8px' }}>
                                          <video
                                            controls
                                            style={{
                                              maxWidth: '100%',
                                              maxHeight: '400px',
                                              borderRadius: '8px',
                                            }}
                                          >
                                            <source src={attachment.url} type={attachment.type} />
                                            Votre navigateur ne supporte pas la vidéo.
                                          </video>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div key={idx} style={{ marginBottom: '4px' }}>
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              padding: '8px 12px',
                                              background: 'rgba(74, 158, 255, 0.1)',
                                              border: '1px solid rgba(74, 158, 255, 0.3)',
                                              borderRadius: '6px',
                                              color: '#4a9eff',
                                              textDecoration: 'none',
                                            }}
                                          >
                                            📎 {attachment.name}
                                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                              ({(attachment.size / 1024).toFixed(1)} KB)
                                            </span>
                                          </a>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                              
                              {/* Texte du message */}
                              {message.text && (
                                <div dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br>') }} />
                              )}
                              
                              {/* Heure et statut modifié */}
                              <div className="message-time-container" style={{ 
                                alignItems: 'center', 
                                justifyContent: 'flex-end',
                                gap: '6px',
                                marginTop: '4px',
                                fontSize: '0.7rem',
                                opacity: 0.7
                              }}>
                                {message.edited && (
                                  <span className="message-edited">(modifié)</span>
                                )}
                                <span className="message-time">{formatTime(message.timestamp)}</span>
                              </div>
                              
                              {/* Boutons de réaction - à l'intérieur de la bulle avec compteurs */}
                              {editingMessageId !== message.id && (() => {
                                // Compter les réactions par emoji
                                const reactionCounts: { [emoji: string]: number } = {};
                                if (message.reactions) {
                                  Object.values(message.reactions).forEach((emoji) => {
                                    reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
                                  });
                                }
                                
                                const getReactionCount = (emoji: string) => reactionCounts[emoji] || 0;
                                const hasUserReaction = (emoji: string) => message.reactions?.[userId] === emoji;
                                
                                return (
                                  <div className="message-reaction-buttons" style={{
                                    display: 'flex',
                                    gap: '4px',
                                    marginTop: '8px',
                                    opacity: 0.7,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                  >
                                    <button
                                      className="reaction-btn-small"
                                      onClick={() => toggleReaction(message.id, '👍')}
                                      title="J'aime"
                                      style={{
                                        background: hasUserReaction('👍') ? 'rgba(74, 158, 255, 0.2)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        minWidth: 'auto',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.background = hasUserReaction('👍') 
                                          ? 'rgba(74, 158, 255, 0.3)' 
                                          : 'rgba(74, 158, 255, 0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = hasUserReaction('👍') 
                                          ? 'rgba(74, 158, 255, 0.2)' 
                                          : 'transparent';
                                      }}
                                    >
                                      <span>👍</span>
                                      {getReactionCount('👍') > 0 && (
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                          {getReactionCount('👍')}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      className="reaction-btn-small"
                                      onClick={() => toggleReaction(message.id, '❤️')}
                                      title="J'adore"
                                      style={{
                                        background: hasUserReaction('❤️') ? 'rgba(255, 100, 100, 0.2)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        minWidth: 'auto',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.background = hasUserReaction('❤️') 
                                          ? 'rgba(255, 100, 100, 0.3)' 
                                          : 'rgba(255, 100, 100, 0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = hasUserReaction('❤️') 
                                          ? 'rgba(255, 100, 100, 0.2)' 
                                          : 'transparent';
                                      }}
                                    >
                                      <span>❤️</span>
                                      {getReactionCount('❤️') > 0 && (
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                          {getReactionCount('❤️')}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      className="reaction-btn-small"
                                      onClick={() => toggleReaction(message.id, '🔥')}
                                      title="Feu"
                                      style={{
                                        background: hasUserReaction('🔥') ? 'rgba(255, 165, 0, 0.2)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        minWidth: 'auto',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.background = hasUserReaction('🔥') 
                                          ? 'rgba(255, 165, 0, 0.3)' 
                                          : 'rgba(255, 165, 0, 0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = hasUserReaction('🔥') 
                                          ? 'rgba(255, 165, 0, 0.2)' 
                                          : 'transparent';
                                      }}
                                    >
                                      <span>🔥</span>
                                      {getReactionCount('🔥') > 0 && (
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                          {getReactionCount('🔥')}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      className="reaction-btn-small"
                                      onClick={() => toggleReaction(message.id, '😡')}
                                      title="Colère"
                                      style={{
                                        background: hasUserReaction('😡') ? 'rgba(255, 100, 100, 0.2)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        minWidth: 'auto',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.background = hasUserReaction('😡') 
                                          ? 'rgba(255, 100, 100, 0.3)' 
                                          : 'rgba(255, 100, 100, 0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = hasUserReaction('😡') 
                                          ? 'rgba(255, 100, 100, 0.2)' 
                                          : 'transparent';
                                      }}
                                    >
                                      <span>😡</span>
                                      {getReactionCount('😡') > 0 && (
                                        <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                          {getReactionCount('😡')}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Menu contextuel */}
                      {clickedMessageId === message.id && messageMenuPosition && (
                        <div 
                          ref={messageMenuRef}
                          className="message-context-menu"
                          style={{
                            position: 'fixed',
                            left: `${messageMenuPosition.x}px`,
                            top: `${Math.max(10, messageMenuPosition.y - 140)}px`,
                            zIndex: 10001,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Menu contextuel */}
                          <div className="context-menu">
                            <button
                              className="context-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReply(message);
                              }}
                            >
                              <span>Répondre</span>
                            </button>
                            {isOwn && (
                              <button
                                className="context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(message.id, message.text);
                                  setClickedMessageId(null);
                                  setMessageMenuPosition(null);
                                }}
                              >
                                <span>Modifier</span>
                              </button>
                            )}
                            <button
                              className="context-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(message.text || '');
                              }}
                            >
                              <span>Copier le texte</span>
                            </button>
                            {isOwn && (
                              <button
                                className="context-menu-item context-menu-item-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(message.id);
                                }}
                              >
                                <span>Supprimer</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} style={{ paddingBottom: '40px', minHeight: '40px' }} />
          </div>
        </div>

        <div className="input-container">
          {/* Fichiers sélectionnés */}
          {selectedFiles.length > 0 && (
            <div className="selected-files" style={{
              padding: '8px',
              background: 'rgba(74, 158, 255, 0.1)',
              borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <span>{getMediaType(file) === 'image' ? '🖼️' : getMediaType(file) === 'video' ? '🎥' : '📎'}</span>
                  <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff6b6b',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Enregistrement vocal */}
          {(isRecordingVoice || recordedAudioBlob) && (
            <div style={{ padding: '8px', background: 'rgba(255, 107, 107, 0.1)', borderBottom: '1px solid rgba(255, 107, 107, 0.2)' }}>
              <VoiceRecorder
                ref={voiceRecorderRef}
                onRecordingComplete={handleVoiceRecordingComplete}
                onCancel={handleVoiceRecordingCancel}
                onStop={handleVoiceRecordingStop}
                maxDuration={60}
                autoStart={true}
              />
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Bouton pour sélectionner des fichiers */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || uploading}
              style={{
                padding: '8px 12px',
                background: 'rgba(74, 158, 255, 0.1)',
                border: '1px solid rgba(74, 158, 255, 0.3)',
                borderRadius: '6px',
                color: '#4a9eff',
                cursor: 'pointer',
                fontSize: '18px',
              }}
              title="Joindre un fichier"
            >
              📎
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              style={{ display: 'none' }}
            />
            
            <input
              type="text"
              className="message-input"
              placeholder={isConnected ? 'Tapez votre message...' : 'Connexion en cours...'}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected || uploading}
              style={{ flex: 1 }}
            />
            
            {/* Bouton pour enregistrer une note vocale (style WhatsApp) */}
            {!messageInput.trim() && selectedFiles.length === 0 && !recordedAudioBlob ? (
              <button
                ref={micButtonRef}
                type="button"
                onMouseDown={handleMicButtonDown}
                onMouseMove={handleMicButtonMove}
                onMouseUp={handleMicButtonUp}
                onMouseLeave={handleMicButtonUp}
                onTouchStart={handleMicButtonDown}
                onTouchMove={handleMicButtonMove}
                onTouchEnd={handleMicButtonUp}
                disabled={!isConnected || uploading}
                style={{
                  padding: '8px 12px',
                  background: isHoldingMic 
                    ? (shouldCancelRecording ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 107, 107, 0.3)')
                    : 'rgba(255, 107, 107, 0.1)',
                  border: isHoldingMic
                    ? (shouldCancelRecording ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 107, 107, 0.6)')
                    : '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '6px',
                  color: isHoldingMic && shouldCancelRecording ? '#ef4444' : '#ff6b6b',
                  cursor: isHoldingMic ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                title={isHoldingMic 
                  ? (shouldCancelRecording ? 'Relâchez pour annuler' : 'Relâchez pour arrêter l\'enregistrement')
                  : 'Maintenez pour enregistrer, glissez vers le haut pour annuler'}
              >
                {isHoldingMic && shouldCancelRecording ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2s-2 .9-2 2v8c0 1.1.9 2 2 2zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </button>
            ) : null}
            
            {messageInput.trim() || selectedFiles.length > 0 || recordedAudioBlob ? (
              <button
                className="send-btn"
                onClick={handleSendMessage}
                disabled={!isConnected || uploading || (!messageInput.trim() && selectedFiles.length === 0 && !recordedAudioBlob && !isRecordingVoice)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px',
                  minWidth: '48px',
                }}
              >
                {uploading ? (
                  <span style={{ fontSize: '0.9rem' }}>Envoi...</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <main className="chat-main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#000000' }}>
          <p>Chargement...</p>
        </div>
      </main>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
