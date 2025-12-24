'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadHistory, saveHistory, RoomHistory, RoomHistoryItem } from '@/utils/storage';
import { subscribeToToasts, showToast, showConfirmToast, closeToast } from '@/utils/toast';
import { ToastContainer, Toast } from '@/components/Toast';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import '../globals.css';
import './canaldiscussion-wa.css';

interface ChatItem {
  id: string;
  name: string;
  type: 'group';
  isPrivate: boolean;
  lastMessage: string;
  timestamp: string;
  avatar: { char: string; color: string };
  room: RoomHistoryItem;
}

export default function CanalDiscussionPage() {
  const router = useRouter();
  const [username] = useState<string>('Membre');
  
  const [showPrivateForm, setShowPrivateForm] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [joinRoomName, setJoinRoomName] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomPassword, setCreatedRoomPassword] = useState<string | null>(null);
  
  const [history, setHistory] = useState<RoomHistory>({ created: [], joined: [] });
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatItem[]>([]);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastMessagesCache, setLastMessagesCache] = useState<{ [key: string]: string }>({});
  
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    
    const unsubscribe = subscribeToToasts((newToasts) => {
      setToasts(newToasts);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Obtenir le dernier message depuis Firebase
  const getLastMessage = async (roomId: string): Promise<string> => {
    try {
      if (lastMessagesCache[roomId]) {
        return lastMessagesCache[roomId];
      }

      const messagesRef = collection(db, 'chats', roomId, 'messages');
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
      const snapshot = await getDocs(messagesQuery);

      if (!snapshot.empty) {
        const lastDoc = snapshot.docs[0];
        const data = lastDoc.data();
        const message = data.message || data.text || '';
        const username = data.username || '';

        let preview = '';
        if (message) {
          preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
        } else {
          preview = '📎 Pièce jointe';
        }

        if (username) {
          preview = `~${username}: ${preview}`;
        }

        setLastMessagesCache(prev => ({ ...prev, [roomId]: preview }));
        return preview;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du dernier message:', error);
    }

    return 'Aucun message';
  };

  // Générer un avatar avec couleur basée sur le nom (palette noir/bleu)
  const getAvatar = (name: string): { char: string; color: string } => {
    if (!name) return { char: '👤', color: '#2563eb' };
    const firstChar = name.charAt(0).toUpperCase();
    // Palette de couleurs noir/bleu
    const colors = [
      '#2563eb', '#1e40af', '#3b82f6', '#1d4ed8', '#1e3a8a',
      '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#3b82f6'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return { char: firstChar, color: colors[colorIndex] };
  };

  // Ajuster la luminosité d'une couleur
  const adjustColor = (color: string, amount: number): string => {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  };

  // Charger les discussions
  useEffect(() => {
    const loadDiscussions = async () => {
      const h = loadHistory();
      const created = h.created || [];
      const joined = h.joined || [];

      const chats: ChatItem[] = [];

      // Fonction pour créer un chat
      const createChat = async (room: RoomHistoryItem): Promise<ChatItem> => {
        const lastMessage = await getLastMessage(room.id);
        return {
          id: room.id,
          name: room.name || extractRoomName(room.id),
          type: 'group',
          isPrivate: room.type === 'private',
          lastMessage: lastMessage,
          timestamp: room.createdAt || room.joinedAt || new Date().toISOString(),
          avatar: getAvatar(room.name || room.id),
          room: room
        };
      };

      // Ajouter les discussions publiques par défaut
      const publicRooms = [
        { id: 'public_aes', name: 'AES', description: 'Alliance des États du Sahel', icon: '🌍' },
        { id: 'public_cedeao', name: 'CEDEAO', description: 'Communauté Économique', icon: '🤝' },
        { id: 'public_uemoa', name: 'UEMOA', description: 'Union Économique', icon: '💼' },
        { id: 'public_autres', name: 'Globale Organisation', description: 'Organisation Globale', icon: '🌐' }
      ];

      for (const publicRoom of publicRooms) {
        const lastMessage = await getLastMessage(publicRoom.id);
        chats.push({
          id: publicRoom.id,
          name: `${publicRoom.icon} ${publicRoom.name}`,
          type: 'group',
          isPrivate: false,
          lastMessage: lastMessage,
          timestamp: new Date().toISOString(),
          avatar: { char: publicRoom.icon, color: '#d32f2f' },
          room: {
            id: publicRoom.id,
            name: publicRoom.name,
            description: publicRoom.description,
            type: 'public',
            createdAt: new Date().toISOString()
          }
        });
      }

      // Ajouter les salons créés
      for (const room of created) {
        const chat = await createChat(room);
        chats.push(chat);
      }

      // Ajouter les salons rejoints
      for (const room of joined) {
        if (!chats.find(c => c.id === room.id)) {
          const chat = await createChat(room);
          chats.push(chat);
        }
      }

      // Trier par timestamp (plus récent en premier)
      chats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAllChats(chats);
    };

    loadDiscussions();
  }, [history]);

  // Filtrer les discussions
  useEffect(() => {
    let filtered = [...allChats];

    // Appliquer le filtre
    if (currentFilter === 'groups') {
      filtered = filtered.filter(chat => chat.type === 'group');
    }

    // Appliquer la recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat =>
        chat.name.toLowerCase().includes(query) ||
        chat.lastMessage.toLowerCase().includes(query)
      );
    }

    setFilteredChats(filtered);
  }, [allChats, currentFilter, searchQuery]);

  // Extraire le nom du salon depuis l'ID
  const extractRoomName = (roomId: string): string => {
    if (roomId.includes('_')) {
      const parts = roomId.split('_');
      if (parts.length > 1) {
        return parts.slice(1).join('_').substring(0, 20) + '...';
      }
    }
    return roomId.substring(0, 20) + '...';
  };

  // Formater l'heure
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  };

  const generateRoomId = () => {
    return 'group_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  };

  const handleCreatePrivateRoom = () => {
    setShowPrivateForm(true);
  };

  const handleCreatePrivateRoomWithPassword = () => {
    if (!roomName.trim()) {
      showToast('Veuillez entrer un nom pour votre discussion.', 'warning');
      return;
    }
    
    if (!roomPassword.trim()) {
      showToast('Veuillez entrer un mot de passe pour la discussion privée.', 'warning');
      return;
    }

    const id = generateRoomId();
    const room: RoomHistoryItem = {
      id,
      name: roomName.trim(),
      password: roomPassword.trim(),
      type: 'private',
      createdAt: new Date().toISOString(),
      isArtist: false,
    };

    const next: RoomHistory = {
      ...history,
      created: [room, ...history.created.filter((r) => r.id !== id)],
    };
    saveHistory(next);
    setHistory(next);

    setCreatedRoomId(id);
    setCreatedRoomPassword(roomPassword.trim());
    setShowPrivateForm(false);
    setRoomName('');
    setRoomPassword('');
    
    showToast('Discussion privée créée avec succès !');
  };

  const handleJoinPublic = (roomType: string = 'aes') => {
    const publicRooms: { [key: string]: { id: string; name: string } } = {
      aes: { id: 'public_aes', name: 'AES' },
      cedeao: { id: 'public_cedeao', name: 'CEDEAO' },
      uemoa: { id: 'public_uemoa', name: 'UEMOA' },
      autres: { id: 'public_autres', name: 'Globale Organisation' }
    };

    const room = publicRooms[roomType] || publicRooms.aes;
    const roomId = room.id;
    
    const item: RoomHistoryItem = {
      id: roomId,
      name: `Discussion Publique - ${room.name}`,
      password: null,
      type: 'public',
      joinedAt: new Date().toISOString(),
    };

    const next: RoomHistory = {
      ...history,
      joined: [item, ...history.joined.filter((r) => r.id !== roomId)],
    };
    saveHistory(next);
    setHistory(next);

    router.push(`/chat?room=${roomId}`);
  };

  const handleJoinByLink = () => {
    const link = linkInput.trim();
    if (!link) {
      showToast('Veuillez coller un lien de discussion valide.', 'warning');
      return;
    }

    try {
      const url = new URL(link);
      const room = url.searchParams.get('room');
      const password = url.searchParams.get('password') || undefined;
      
      if (!room || (!room.startsWith('group_') && !room.startsWith('member_') && !room.startsWith('public_'))) {
        showToast('Le lien fourni ne semble pas être un lien de discussion valide.', 'error');
        return;
      }

      const item: RoomHistoryItem = {
        id: room,
        name: 'Discussion via lien',
        password,
        type: password ? 'private' : 'public',
        joinedAt: new Date().toISOString(),
      };

      const next: RoomHistory = {
        ...history,
        joined: [item, ...history.joined.filter((r) => r.id !== room)],
      };
      saveHistory(next);
      setHistory(next);

      router.push(
        `/chat?room=${encodeURIComponent(room)}${
          password ? `&password=${encodeURIComponent(password)}` : ''
        }`
      );
    } catch {
      showToast('Lien invalide.', 'error');
    }
  };

  const handleJoinPrivateRoom = () => {
    if (!joinRoomName.trim()) {
      showToast('Veuillez entrer le nom de la discussion.', 'warning');
      return;
    }
    
    if (!joinPassword.trim()) {
      showToast('Veuillez entrer le mot de passe de la discussion.', 'warning');
      return;
    }

    let fullId = joinRoomName.trim();
    if (!fullId.startsWith('group_') && !fullId.startsWith('member_') && !fullId.startsWith('public_')) {
      fullId = 'group_' + fullId.toLowerCase().replace(/\s+/g, '_');
    }

    const item: RoomHistoryItem = {
      id: fullId,
      name: joinRoomName.trim(),
      password: joinPassword.trim(),
      type: 'private',
      joinedAt: new Date().toISOString(),
    };

    const next: RoomHistory = {
      ...history,
      joined: [item, ...history.joined.filter((r) => r.id !== fullId)],
    };
    saveHistory(next);
    setHistory(next);

    router.push(
      `/chat?room=${encodeURIComponent(fullId)}&password=${encodeURIComponent(
        joinPassword.trim()
      )}`
    );
  };

  const handleRejoinRoom = (chat: ChatItem) => {
    router.push(
      `/chat?room=${encodeURIComponent(chat.room.id)}${
        chat.room.password ? `&password=${encodeURIComponent(chat.room.password)}` : ''
      }`
    );
  };

  const handleDeleteRoom = (chatId: string) => {
    const chat = allChats.find(c => c.id === chatId);
    if (!chat) return;

    const isCreated = history.created.find(r => r.id === chatId);
    const type = isCreated ? 'created' : 'joined';
    const index = isCreated 
      ? history.created.findIndex(r => r.id === chatId)
      : history.joined.findIndex(r => r.id === chatId);

    showConfirmToast(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer "<strong>${chat.name}</strong>" de votre historique ?<br><br><small style="color: #999;">Cette action est irréversible.</small>`,
      () => {
        const next = { ...history };
        next[type].splice(index, 1);
        saveHistory(next);
        setHistory(next);
        showToast(`"${chat.name}" supprimé de l'historique`);
      }
    );
  };

  const copyGeneratedLink = () => {
    if (!createdRoomId) return;
    
    const roomUrl = `${window.location.origin}/chat?room=${createdRoomId}&password=${encodeURIComponent(createdRoomPassword || '')}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomUrl).then(() => {
        showToast('Lien de la discussion privée copié !');
      });
    }
  };

  const enterCreatedRoom = () => {
    if (createdRoomId) {
      router.push(
        `/chat?room=${createdRoomId}${
          createdRoomPassword ? `&password=${encodeURIComponent(createdRoomPassword)}` : ''
        }`
      );
    }
  };

  const groupsCount = allChats.filter(chat => chat.type === 'group').length;

  return (
    <div className="wa-container">
      {/* Header */}
      <header className="wa-header">
        <div className="header-top">
          <button className="header-btn menu-btn" onClick={() => setShowJoinModal(true)}>
            <span>☰</span>
          </button>
          <h1 className="header-title">Discussions</h1>
          <div className="header-actions">
            <button className="header-btn new-chat-btn" onClick={() => setShowPrivateForm(true)}>
              <span>+</span>
            </button>
          </div>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Rechercher une discussion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </header>

      {/* Chat Filters */}
      <div className="chat-filters">
        <button
          className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${currentFilter === 'groups' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('groups')}
        >
          Groups {groupsCount > 0 && <span className="filter-count">{groupsCount}</span>}
        </button>
      </div>

      {/* Public Rooms Section */}
      {currentFilter === 'all' && (
        <div className="public-rooms-section">
          <h4 className="public-rooms-title">Discussions Publiques</h4>
          <div className="public-room-grid">
            {allChats
              .filter(chat => chat.id.startsWith('public_'))
              .map((chat) => {
                const publicRoomInfo: { [key: string]: { icon: string; description: string } } = {
                  'public_aes': { icon: '🌍', description: 'Alliance des États du Sahel' },
                  'public_cedeao': { icon: '🤝', description: 'Communauté Économique' },
                  'public_uemoa': { icon: '💼', description: 'Union Économique' },
                  'public_autres': { icon: '🌐', description: 'Organisation Globale' }
                };
                const info = publicRoomInfo[chat.id] || { icon: '🌐', description: '' };
                
                return (
                  <button
                    key={chat.id}
                    className="public-room-btn"
                    onClick={() => handleRejoinRoom(chat)}
                  >
                    <span>{info.icon}</span>
                    <span>{chat.room.name || chat.name.replace(info.icon + ' ', '')}</span>
                    <small>{info.description}</small>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="chat-list">
        {filteredChats.filter(chat => !chat.id.startsWith('public_')).length === 0 ? (
          <div className="empty-state">
            <p>Aucune discussion</p>
            <small>Créez votre première discussion pour commencer</small>
          </div>
        ) : (
          filteredChats.filter(chat => !chat.id.startsWith('public_')).map((chat) => {
            const time = formatTime(chat.timestamp);
            const avatar = chat.avatar;

            return (
              <div key={chat.id} className="chat-item" onClick={() => handleRejoinRoom(chat)}>
                <div className="chat-avatar">
                  <div
                    className="avatar-circle"
                    style={{
                      background: `linear-gradient(135deg, ${avatar.color} 0%, ${adjustColor(avatar.color, -20)} 100%)`
                    }}
                  >
                    {avatar.char}
                  </div>
                </div>
                <div className="chat-content">
                  <div className="chat-header">
                    <span className="chat-name">{chat.name}</span>
                    <span className="chat-time">
                      {time}
                    </span>
                  </div>
                  {chat.room.description && (
                    <div className="chat-description" style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px' }}>
                      {chat.room.description}
                    </div>
                  )}
                  <div className="chat-preview">
                    <span className="chat-message">{chat.lastMessage}</span>
                  </div>
                </div>
                {!chat.id.startsWith('public_') && (
                  <button 
                    className="chat-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoom(chat.id);
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showPrivateForm && (
        <div className="modal-overlay" onClick={() => setShowPrivateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">🔐 Créer une Discussion Privée</h3>
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder="Nom de la discussion"
                maxLength={30}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePrivateRoomWithPassword()}
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                placeholder="Mot de passe de la discussion"
                maxLength={50}
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePrivateRoomWithPassword()}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => {
                setShowPrivateForm(false);
                setRoomName('');
                setRoomPassword('');
              }}>
                Annuler
              </button>
              <button className="modal-btn confirm" onClick={handleCreatePrivateRoomWithPassword}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">📋 Rejoindre une Discussion</h3>
            
            <div className="join-section-modal">
              <h4>Rejoindre par lien</h4>
              <div className="join-form-modal">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Collez votre lien d'invitation..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinByLink()}
                />
                <button className="modal-btn confirm" onClick={() => { handleJoinByLink(); setShowJoinModal(false); }}>
                  Rejoindre
                </button>
              </div>
            </div>

            <div className="join-section-modal">
              <h4>🔐 Rejoindre une Discussion Privée</h4>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nom de la discussion"
                  value={joinRoomName}
                  onChange={(e) => setJoinRoomName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mot de passe de la discussion"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinPrivateRoom()}
                />
              </div>
              <button className="modal-btn confirm" onClick={() => { handleJoinPrivateRoom(); setShowJoinModal(false); }}>
                Rejoindre
              </button>
            </div>

            <button className="modal-btn cancel" onClick={() => setShowJoinModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {createdRoomId && (
        <div className="modal-overlay" onClick={() => setCreatedRoomId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Discussion créée !</h3>
            <div className="created-room-info">
              <p><strong>Nom:</strong> {history.created.find(r => r.id === createdRoomId)?.name}</p>
              <p><strong>ID:</strong> {createdRoomId.substring(8, 16)}...</p>
              <p><strong>Mot de passe:</strong> {'*'.repeat(createdRoomPassword?.length || 0)}</p>
              <div className="generated-link-text">
                {`${window.location.origin}/chat?room=${createdRoomId}&password=${encodeURIComponent(createdRoomPassword || '')}`}
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setCreatedRoomId(null)}>
                Fermer
              </button>
              <button className="modal-btn confirm" onClick={copyGeneratedLink}>
                Copier le lien
              </button>
              <button className="modal-btn confirm" onClick={enterCreatedRoom}>
                Entrer
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}
