'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, FileAttachment } from '@/hooks/useChat';
import VoiceRecorder, { VoiceRecorderRef } from '@/components/VoiceRecorder';
import { IconLock, IconStatusDot, IconAttachment, IconImage, IconVideo, IconMusic, IconSettings, IconTrash } from '@/components/Icons';
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
  const [bannerMessage, setBannerMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
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
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const voiceRecorderRef = useRef<VoiceRecorderRef>(null);
  const cancelRecordingHandlerRef = useRef<() => void>(() => {});
  const [isScrollingMessages, setIsScrollingMessages] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [userAvatarsMap, setUserAvatarsMap] = useState<Record<string, string>>({});

  const isPrivateRoom = !!roomPassword;
  const isPublicRoom = roomId?.startsWith('public_');
  
  // Noms pour les descriptions (sous le header)
  const getPublicRoomName = (roomId: string | null) => {
    if (!roomId) return 'Discussion';
    const roomNames: { [key: string]: string } = {
      'public_aes': 'AES',
      'public_cemac': 'CEMAC',
      'public_uemoa': 'UEMOA',
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
    isCreator,
    isRemovedFromGroup,
    roomCreatorId,
    members,
    removeMember,
  } = useChat({
    roomId: roomId || '',
    roomPassword,
    username,
    userId: userId || '', // Passer une chaîne vide si userId est null
    userAvatar: userProfile?.avatar ?? undefined,
    isPrivateRoom,
  });
  
  // Tous les useEffect doivent être appelés avant tout return conditionnel

  useEffect(() => {
    if (!roomId) {
      router.push('/canaldiscussion');
    }
  }, [roomId, router]);

  // Récupérer les photos de profil des expéditeurs pour afficher les avatars à côté des messages
  useEffect(() => {
    if (!messages.length) {
      setUserAvatarsMap({});
      return;
    }
    const userIds = [...new Set(messages.map((m) => m.userId).filter(Boolean))];
    if (userIds.length === 0) return;
    let cancelled = false;
    fetch('/api/users/avatars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.avatars) setUserAvatarsMap(data.avatars);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [messages]);

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

  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isHoldingMic || !holdStartPositionRef.current) return;
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY) : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    const deltaY = holdStartPositionRef.current.y - clientY;
    const deltaX = Math.abs(holdStartPositionRef.current.x - clientX);
    if (deltaY > 50 || deltaX > 100) {
      setShouldCancelRecording(true);
    } else {
      setShouldCancelRecording(false);
    }
  }, [isHoldingMic]);

  const handleGlobalUp = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isHoldingMic) return;
    e.preventDefault();
    document.removeEventListener('mousemove', handleGlobalMove);
    document.removeEventListener('mouseup', handleGlobalUp);
    document.removeEventListener('touchmove', handleGlobalMove);
    document.removeEventListener('touchend', handleGlobalUp);
    const shouldCancel = shouldCancelRecording;
    setShouldCancelRecording(false);
    if (shouldCancel) {
      cancelRecordingHandlerRef.current();
    } else {
      if (voiceRecorderRef.current && voiceRecorderRef.current.isRecording) {
        voiceRecorderRef.current.stopAndGetAudio().then((audioBlob) => {
          if (audioBlob) setRecordedAudioBlob(audioBlob);
          setIsRecordingVoice(false);
          setIsHoldingMic(false);
        });
      } else {
        setIsHoldingMic(false);
      }
    }
    holdStartPositionRef.current = null;
  }, [isHoldingMic, shouldCancelRecording]);

  const handleVoiceRecordingCancel = useCallback(() => {
    setIsRecordingVoice(false);
    setRecordedAudioBlob(null);
    setIsHoldingMic(false);
    setShouldCancelRecording(false);
    holdStartPositionRef.current = null;
    document.removeEventListener('mousemove', handleGlobalMove);
    document.removeEventListener('mouseup', handleGlobalUp);
    document.removeEventListener('touchmove', handleGlobalMove);
    document.removeEventListener('touchend', handleGlobalUp);
  }, [handleGlobalMove, handleGlobalUp]);

  useEffect(() => {
    cancelRecordingHandlerRef.current = handleVoiceRecordingCancel;
  }, [handleVoiceRecordingCancel]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalUp);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalUp);
    };
  }, [handleGlobalMove, handleGlobalUp]);
  
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
          setBannerMessage({ type: 'error', text: `Erreur lors de l'upload de la note vocale: ${error.message}` });
        }
      }

      // Upload des fichiers sélectionnés
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          if (!isFileTypeAllowed(file)) {
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
            // Erreur upload fichier
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
      setBannerMessage({ type: 'error', text: `Erreur lors de l'envoi du message: ${error.message}` });
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
      setBannerMessage({ type: 'error', text: `Erreur lors de l'upload de la note vocale: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecordingStop = (audioBlob: Blob | null) => {
    setRecordedAudioBlob(audioBlob);
  };

  const handleMicButtonDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isConnected || uploading) return;
    e.preventDefault();
    setIsHoldingMic(true);
    setShouldCancelRecording(false);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    holdStartPositionRef.current = { x: clientX, y: clientY };
    setIsRecordingVoice(true);
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalUp);
    document.addEventListener('touchmove', handleGlobalMove, { passive: false });
    document.addEventListener('touchend', handleGlobalUp);
  };

  const handleMicButtonMove = (_e: React.MouseEvent | React.TouchEvent) => {};
  const handleMicButtonUp = (_e: React.MouseEvent | React.TouchEvent) => {};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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



  const formatRelativeTime = (date: Date | number) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffH / 24);
    if (diffSec < 60) return 'À l\'instant';
    if (diffMin < 60) return diffMin <= 1 ? 'il y a 1 min' : `il y a ${diffMin} min`;
    if (diffH < 24) return diffH <= 1 ? 'il y a 1 h' : `il y a ${diffH} h`;
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks <= 1 ? 'il y a 1 semaine' : `il y a ${weeks} semaines`;
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const shouldShowMessageHeader = (currentMessage: any, nextMessage: any) => {
    if (!nextMessage) return true;
    if (currentMessage.userId !== nextMessage.userId) return true;
    return false;
  };

  if (!roomId) {
    return null;
  }

  if (isPrivateRoom && !passwordVerified && connectionStatus === 'offline') {
    return (
      <main style={{ padding: 40, color: '#ffffff', textAlign: 'center', background: '#0a0e27' }}>
        <div className="error-message" style={{ textAlign: 'center', padding: '40px' }}>
          <h2><IconLock size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Accès Refusé</h2>
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

  if (connectionStatus === 'removed' || isRemovedFromGroup) {
    return (
      <main style={{ padding: 40, color: '#ffffff', textAlign: 'center', background: '#0a0e27' }}>
        <div className="error-message" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Vous avez été retiré de ce groupe</h2>
          <p style={{ margin: '20px 0' }}>
            L&apos;administrateur du groupe vous a retiré. Vous ne pouvez plus accéder à cette discussion.
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

  const chatTitle = isPublicRoom ? getPublicRoomName(roomId) : 'Discussion privée';
  const chatSubtitle = members.length > 0 ? `${members.length} membre${members.length > 1 ? 's' : ''}` : '';

  return (
    <main className="chat-main-container">
      {showGroupSettingsModal && isPrivateRoom && isCreator && (
        <div
          className="withdraw-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={() => setShowGroupSettingsModal(false)}
        >
          <div
            className="withdraw-modal"
            style={{ maxWidth: 400, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="withdraw-modal-header">
              <div className="withdraw-modal-header-inner">
                <IconSettings size={24} />
                <h3 className="withdraw-modal-title">Paramètres du groupe</h3>
              </div>
              <button type="button" className="withdraw-modal-close" onClick={() => setShowGroupSettingsModal(false)} aria-label="Fermer">×</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>Membres du groupe ({members.length})</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {members.map((member) => (
                  <li
                    key={member.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74, 158, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#4a9eff' }}>
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{member.username}</span>
                      {member.userId === roomCreatorId && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(74, 158, 255, 0.3)', color: '#4a9eff', padding: '2px 8px', borderRadius: 6 }}>Créateur</span>
                      )}
                    </div>
                    {member.userId !== roomCreatorId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Retirer ${member.username} du groupe ?`)) {
                            removeMember(member.userId);
                            setBannerMessage({ type: 'success', text: `${member.username} a été retiré du groupe.` });
                            setTimeout(() => setBannerMessage(null), 3000);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: 6,
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                        title="Retirer du groupe"
                      >
                        <IconTrash size={14} /> Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {members.length === 0 && (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Aucun autre membre pour le moment.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="chat-content">
          <div className="chat-header-fixed">
            <div className="chat-header-container chat-header-messenger">
              <a href="/canaldiscussion" className="leave-btn" title="Retour" aria-label="Retour">
                ‹
              </a>
              <div className="chat-header-center">
                <div className="chat-header-title-container">
                  <h1 className="chat-header-title">{chatTitle}</h1>
                  {chatSubtitle && <p className="chat-header-subtitle">{chatSubtitle}</p>}
                </div>
              </div>
              <div className="chat-header-right">
                <div
                  className="chat-header-status-right"
                  title={
                    connectionStatus === 'online' ? 'Connecté' :
                    connectionStatus === 'connecting' ? 'Connexion...' :
                    'Hors ligne'
                  }
                >
                  <div id="statusIndicator" className={`status-indicator ${connectionStatus}`} />
                </div>
                <div className="chat-header-avatar" title={username}>
                  {userProfile?.avatar ? (
                    <img key={userProfile.avatar} src={userProfile.avatar} alt="" className="chat-header-avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    username.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Message épinglé (placeholder - pas de donnée backend pour l'instant) */}
          <div className="pinned-message-bar" style={{ display: 'none' }}>
            <span className="pinned-label">Message épinglé</span>
            <span className="pinned-preview">—</span>
          </div>
          {bannerMessage && (
            <div
              className="chat-banner-message"
              style={{
                padding: '10px 14px',
                margin: '0 12px 8px',
                borderRadius: 8,
                fontSize: 14,
                background: bannerMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: bannerMessage.type === 'error' ? '#ef4444' : '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{bannerMessage.text}</span>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit', opacity: 0.8 }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          )}
          <div
            className={`messages ${isScrollingMessages ? 'is-scrolling' : ''}`}
            id="messages"
            onScroll={() => {
              setIsScrollingMessages(true);
              if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
              scrollTimeoutRef.current = setTimeout(() => {
                setIsScrollingMessages(false);
                scrollTimeoutRef.current = null;
              }, 800);
            }}
          >
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
                <p style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IconStatusDot color="#ef4444" size={12} /> Hors ligne</p>
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
                const nextMessage = messages[index + 1];
                const showHeader = shouldShowMessageHeader(message, nextMessage);
                const isConsecutive = nextMessage && nextMessage.userId === message.userId;

                return (
                  <div key={message.id}>
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
                          {(message.avatar || userAvatarsMap[message.userId] || (isOwn && userProfile?.avatar)) ? (
                            <img
                              src={message.avatar || userAvatarsMap[message.userId] || userProfile?.avatar || ''}
                              alt=""
                              className="avatar-img"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="avatar-initial">
                              {message.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="message-details">
                          <div className="username-display">
                            {message.username}
                            {message.isArtist && <><IconMusic size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} /></>}
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
                                            <IconAttachment size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {attachment.name}
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
                              
                              {/* Texte du message + heure à droite */}
                              <div className="message-text-row">
                                <div className="message-text-content">
                                  {message.text && (
                                    <span dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br>') }} />
                                  )}
                                </div>
                                <span className="message-time-inline">
                                  {message.edited && <span className="message-edited">(modifié) </span>}
                                  {formatRelativeTime(message.timestamp)}
                                </span>
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
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(message.id, '👍'); }}
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
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(message.id, '🔥'); }}
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
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(message.id, '😡'); }}
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
                  <span>{getMediaType(file) === 'image' ? <IconImage size={16} /> : getMediaType(file) === 'video' ? <IconVideo size={16} /> : <IconAttachment size={16} />}</span>
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
          
          {/* Enregistrement vocal - Positionné en haut à droite */}
          {(isRecordingVoice || recordedAudioBlob) && (
            <div style={{ 
              position: 'fixed',
              bottom: '80px',
              right: '20px',
              zIndex: 1000,
              maxWidth: '300px',
              minWidth: '200px'
            }}>
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
              className="input-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || uploading}
              title="Joindre un fichier"
            >
              <IconAttachment size={20} />
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
              placeholder={isConnected ? 'Message' : 'Connexion...'}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected || uploading}
              style={{ flex: 1 }}
            />
            
            {/* Bouton pour enregistrer une note vocale */}
            {!messageInput.trim() && selectedFiles.length === 0 && !recordedAudioBlob ? (
              <button
                ref={micButtonRef}
                type="button"
                className={`input-mic-btn ${isHoldingMic && shouldCancelRecording ? 'input-mic-btn-cancel' : ''} ${isHoldingMic ? 'input-mic-btn-holding' : ''}`}
                onMouseDown={handleMicButtonDown}
                onMouseMove={handleMicButtonMove}
                onMouseUp={handleMicButtonUp}
                onMouseLeave={handleMicButtonUp}
                onTouchStart={handleMicButtonDown}
                onTouchMove={handleMicButtonMove}
                onTouchEnd={handleMicButtonUp}
                disabled={!isConnected || uploading}
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
                type="button"
                className="send-btn"
                onClick={handleSendMessage}
                disabled={!isConnected || uploading || (!messageInput.trim() && selectedFiles.length === 0 && !recordedAudioBlob && !isRecordingVoice)}
                title="Envoyer"
              >
                {uploading ? (
                  <span className="send-btn-text">Envoi...</span>
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
      </div>
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
