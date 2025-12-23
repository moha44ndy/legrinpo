'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useChat } from '@/hooks/useChat';
import { subscribeToToasts, showToast, closeToast } from '@/utils/toast';
import { ToastContainer, Toast } from '@/components/Toast';
import '../globals.css';
import '/css/chat_de_discussion.css';

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('room');
  const roomPassword = searchParams.get('password') || undefined;

  const [username] = useState('Membre');
  const [userId] = useState(`user_${Date.now()}`);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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

  const {
    messages,
    isConnected,
    connectionStatus,
    passwordVerified,
    sendMessage,
    editMessage,
    deleteMessage,
    messagesEndRef,
    scrollToBottom,
  } = useChat({
    roomId: roomId || '',
    roomPassword,
    username,
    userId,
    isPrivateRoom,
  });

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

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessage(messageInput);
    setMessageInput('');
  };

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
    }
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

  if (!roomId) {
    return null;
  }

  if (isPrivateRoom && !passwordVerified && connectionStatus === 'offline') {
    return (
      <main style={{ padding: 40, color: '#000000', textAlign: 'center', background: '#ffffff' }}>
        <div className="error-message" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>🔐 Accès Refusé</h2>
          <p style={{ margin: '20px 0' }}>
            Le mot de passe pour cette discussion privée est incorrect ou manquant.
          </p>
          <a
            href="/canaldiscussion"
            style={{
              background: '#d32f2f',
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
        <h1>
          {isPublicRoom ? `🌍 ${getPublicRoomName(roomId)}` : isPrivateRoom ? '🔐 Discussion Privée' : '💬 Discussion'}
        </h1>
        <div className="room-info">
          {isPublicRoom ? `Discussion Publique - ${getPublicRoomName(roomId)}` : `Discussion: ${roomId?.substring(0, 20)}...`}
        </div>
        <div className="participants-info">
          {messages.length > 0 && `${new Set(messages.map((m) => m.userId)).size} participant(s)`}
        </div>
        <div id="statusIndicator" className={`status-indicator ${connectionStatus}`} title={
          connectionStatus === 'online' ? '🟢 Connecté à M&Omusic' :
          connectionStatus === 'connecting' ? '🟡 Connexion...' :
          '🔴 Hors ligne'
        } />
      </div>

      <div className="chat-container">
        <div className="chat-content">
          <div className="messages" id="messages">
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(0, 0, 0, 0.6)' }}>
                <p>Aucun message pour le moment.</p>
                <p>Commencez la discussion en envoyant un message !</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.userId === userId;
                const showDate = shouldShowDateSeparator(message, messages[index - 1]);

                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="date-separator">
                        <div className="date-separator-line" />
                        <div className="date-separator-text">{formatDate(message.timestamp)}</div>
                        <div className="date-separator-line" />
                      </div>
                    )}
                    <div className={`message ${isOwn ? 'own' : ''} ${message.isArtist ? 'artist' : ''}`}>
                      <div className="message-header">
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
                          <div className="message-time">{formatTime(message.timestamp)}</div>
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
                                  background: 'rgba(0, 0, 0, 0.05)',
                                  color: '#000000',
                                  border: '1px solid rgba(211, 47, 47, 0.3)',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button
                                  onClick={handleSaveEdit}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#d32f2f',
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
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    color: '#000000',
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
                              <div dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br>') }} />
                              {message.edited && (
                                <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '8px' }}>
                                  (modifié)
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {isOwn && editingMessageId !== message.id && (
                          <div className="message-actions">
                            <button
                              className="edit-message-btn"
                              onClick={() => handleEdit(message.id, message.text)}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              className="delete-message-btn"
                              onClick={() => handleDelete(message.id)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="input-container">
          <input
            type="text"
            className="message-input"
            placeholder={isConnected ? 'Tapez votre message...' : 'Connexion en cours...'}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!isConnected || !messageInput.trim()}
          >
            Envoyer
          </button>
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
