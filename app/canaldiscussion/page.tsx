'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { loadHistory, saveHistory, RoomHistory, RoomHistoryItem } from '@/utils/storage';
import Wallet from '@/components/Wallet';
import { IconGlobe, IconAes, IconCemac, IconUemoa, IconHandshake, IconBriefcase, IconGlobeAlt, IconLock, IconClipboard, IconSearch, IconStar, IconTrash, IconMenu } from '@/components/Icons';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, Timestamp } from 'firebase/firestore';
import '../globals.css';
import './canaldiscussion-wa.css';

type PublicIconKey = 'globe' | 'aes' | 'cemac' | 'uemoa' | 'handshake' | 'briefcase' | 'globeAlt';

interface ChatItem {
  id: string;
  name: string;
  type: 'group';
  isPrivate: boolean;
  lastMessage: string;
  timestamp: string;
  avatar: { char: string; color: string };
  room: RoomHistoryItem;
  isUnread?: boolean;
  isFavorite?: boolean;
  iconKey?: PublicIconKey;
}

export default function CanalDiscussionPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const username = userProfile?.username || userProfile?.displayName || user?.displayName || 'Membre';
  // Utiliser uid de userProfile ou user, ou générer un ID temporaire
  const userId = userProfile?.uid || user?.uid || (user?.id ? `db_${user.id}` : `temp_${Date.now()}`);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinModalMode, setJoinModalMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [joinRoomName, setJoinRoomName] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomPassword, setCreatedRoomPassword] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [history, setHistory] = useState<RoomHistory>({ created: [], joined: [] });
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatItem[]>([]);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'groups' | 'unread' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [lastMessagesCache, setLastMessagesCache] = useState<{ [key: string]: string }>({});
  const [lastMessageTimestamps, setLastMessageTimestamps] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Obtenir le dernier message depuis Firebase
  const getLastMessage = async (roomId: string): Promise<string> => {
    try {
      if (lastMessagesCache[roomId]) {
        return lastMessagesCache[roomId];
      }

      if (!db) return '';

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
          preview = 'Pièce jointe';
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
    if (!name) return { char: '?', color: '#2563eb' };
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

      // Salons publics : uniquement ceux présents dans Firebase (ajoutés par l'admin)
      let publicRooms: { id: string; name: string; description: string; iconKey?: PublicIconKey }[] = [];
      if (db) {
        try {
          const roomsRef = collection(db, 'rooms');
          const q = query(roomsRef, where('type', '==', 'public'));
          const snapshot = await getDocs(q);
          const iconByRoomId: Record<string, PublicIconKey> = {
            public_aes: 'aes',
            public_cemac: 'cemac',
            public_uemoa: 'uemoa',
            public_autres: 'globeAlt',
            public_global_organisation: 'globeAlt'
          };
          publicRooms = snapshot.docs
            .map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: (d.name as string) || doc.id,
                description: (d.description as string) || '',
                iconKey: iconByRoomId[doc.id]
              };
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (err) {
          console.error('Erreur chargement salons publics Firebase:', err);
        }
      }

      for (const publicRoom of publicRooms) {
        const lastMessage = await getLastMessage(publicRoom.id);
        chats.push({
          id: publicRoom.id,
          name: publicRoom.name,
          type: 'group',
          isPrivate: false,
          lastMessage: lastMessage,
          timestamp: new Date().toISOString(),
          avatar: { char: (publicRoom.name || '?').charAt(0), color: '#d32f2f' },
          iconKey: publicRoom.iconKey,
          room: {
            id: publicRoom.id,
            name: publicRoom.name,
            description: publicRoom.description || '',
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
      
      // Initialiser les timestamps des derniers messages
      const timestamps: { [key: string]: number } = {};
      for (const chat of chats) {
        timestamps[chat.id] = new Date(chat.timestamp).getTime();
      }
      setLastMessageTimestamps(timestamps);
    };

    loadDiscussions();
  }, [history]);

  // Écouter les nouveaux messages en temps réel pour marquer comme non lu
  useEffect(() => {
    if (allChats.length === 0) return;

    const unsubscribes: (() => void)[] = [];
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isInChat = currentPath.startsWith('/chat');
    
    // Si on est dans une discussion, récupérer l'ID de la room depuis l'URL
    let activeRoomId: string | null = null;
    if (isInChat && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      activeRoomId = params.get('room');
    }

    allChats.forEach((chat) => {
      // Ne pas écouter si on est dans cette discussion
      if (chat.id === activeRoomId) return;

      try {
        if (!db) return;
        
        const messagesRef = collection(db, 'chats', chat.id, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        
        const unsubscribe = onSnapshot(
          messagesQuery,
          (snapshot) => {
            if (!snapshot.empty) {
              const lastDoc = snapshot.docs[0];
              const data = lastDoc.data();
              const messageTimestamp = data.timestamp?.toMillis?.() || (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : new Date().getTime());
              const messageUsername = data.username || '';
              const currentUser = username || 'Membre';
              
              // Vérifier si c'est un nouveau message (plus récent que le dernier connu)
              const lastKnownTimestamp = lastMessageTimestamps[chat.id] || 0;
              
              if (messageTimestamp > lastKnownTimestamp) {
                // Mettre à jour le timestamp
                setLastMessageTimestamps(prev => ({
                  ...prev,
                  [chat.id]: messageTimestamp
                }));
                
                // Mettre à jour le cache du dernier message
                const message = data.message || data.text || '';
                let preview = '';
                if (message) {
                  preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
                } else {
                  preview = 'Pièce jointe';
                }
                
                if (messageUsername) {
                  preview = `~${messageUsername}: ${preview}`;
                }
                
                setLastMessagesCache(prev => ({ ...prev, [chat.id]: preview }));
                
                // Marquer comme non lu seulement si :
                // 1. Ce n'est pas l'utilisateur actuel qui a envoyé le message
                // 2. On n'est pas actuellement dans cette discussion
                if (messageUsername !== currentUser && chat.id !== activeRoomId) {
                  setUnreadChats(prev => {
                    const newUnread = new Set(prev);
                    newUnread.add(chat.id);
                    localStorage.setItem('chat_unread', JSON.stringify(Array.from(newUnread)));
                    return newUnread;
                  });
                }
              }
            }
          },
          (error) => {
            console.error(`Erreur lors de l'écoute des messages pour ${chat.id}:`, error);
          }
        );
        
        unsubscribes.push(unsubscribe);
      } catch (error) {
        console.error(`Erreur lors de la configuration de l'écoute pour ${chat.id}:`, error);
      }
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [allChats, username, lastMessageTimestamps]);

  // Filtrer les discussions
  useEffect(() => {
    let filtered = [...allChats];

    // Appliquer le filtre
    if (currentFilter === 'groups') {
      filtered = filtered.filter(chat => chat.type === 'group');
    } else if (currentFilter === 'unread') {
      filtered = filtered.filter(chat => unreadChats.has(chat.id));
    } else if (currentFilter === 'favorites') {
      filtered = filtered.filter(chat => favorites.has(chat.id));
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
  }, [allChats, currentFilter, searchQuery, favorites, unreadChats]);

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

  const handleCreatePrivateRoomWithPassword = () => {
    setModalMessage(null);
    if (!roomName.trim()) {
      setModalMessage({ type: 'error', text: 'Veuillez entrer un nom pour votre discussion.' });
      return;
    }
    if (!roomPassword.trim()) {
      setModalMessage({ type: 'error', text: 'Veuillez entrer un mot de passe pour la discussion privée.' });
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
    setShowJoinModal(false);
    setRoomName('');
    setRoomPassword('');
  };

  const handleJoinPublic = (roomType: string = 'aes') => {
    const publicRooms: { [key: string]: { id: string; name: string } } = {
      aes: { id: 'public_aes', name: 'AES' },
      cemac: { id: 'public_cemac', name: 'CEMAC' },
      uemoa: { id: 'public_uemoa', name: 'UEMOA' },
      autres: { id: 'public_global_organisation', name: 'Global Organisation' }
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
    if (!link) return;

    try {
      const url = new URL(link);
      const room = url.searchParams.get('room');
      const password = url.searchParams.get('password') || undefined;
      
      if (!room || (!room.startsWith('group_') && !room.startsWith('member_') && !room.startsWith('public_'))) return;

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
      setModalMessage({ type: 'error', text: 'Lien invalide.' });
    }
  };

  const handleJoinPrivateRoom = () => {
    if (!joinRoomName.trim()) return;
    if (!joinPassword.trim()) return;

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
    // Marquer comme lu quand on ouvre la discussion
    if (unreadChats.has(chat.id)) {
      const newUnread = new Set(unreadChats);
      newUnread.delete(chat.id);
      setUnreadChats(newUnread);
      localStorage.setItem('chat_unread', JSON.stringify(Array.from(newUnread)));
    }
    
    // Mettre à jour le timestamp du dernier message lu
    setLastMessageTimestamps(prev => ({
      ...prev,
      [chat.id]: Date.now()
    }));
    
    router.push(
      `/chat?room=${encodeURIComponent(chat.room.id)}${
        chat.room.password ? `&password=${encodeURIComponent(chat.room.password)}` : ''
      }`
    );
  };

  const toggleFavorite = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = new Set(favorites);
    if (newFavorites.has(chatId)) {
      newFavorites.delete(chatId);
    } else {
      newFavorites.add(chatId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('chat_favorites', JSON.stringify(Array.from(newFavorites)));
  };

  const toggleUnread = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newUnread = new Set(unreadChats);
    if (newUnread.has(chatId)) {
      newUnread.delete(chatId);
    } else {
      newUnread.add(chatId);
    }
    setUnreadChats(newUnread);
    localStorage.setItem('chat_unread', JSON.stringify(Array.from(newUnread)));
  };

  const handleDeleteRoom = (chatId: string) => {
    const chat = allChats.find(c => c.id === chatId);
    if (!chat) return;

    const isCreated = history.created.find(r => r.id === chatId);
    const type = isCreated ? 'created' : 'joined';
    const index = isCreated 
      ? history.created.findIndex(r => r.id === chatId)
      : history.joined.findIndex(r => r.id === chatId);

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer "${chat.name}" de votre historique ?`)) return;
    const next = { ...history };
    next[type].splice(index, 1);
    saveHistory(next);
    setHistory(next);
  };

  const copyGeneratedLink = () => {
    if (!createdRoomId) return;
    const roomUrl = `${window.location.origin}/chat?room=${createdRoomId}&password=${encodeURIComponent(createdRoomPassword || '')}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
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
  const unreadCount = allChats.filter(chat => unreadChats.has(chat.id)).length;
  const favoritesCount = allChats.filter(chat => favorites.has(chat.id)).length;

  // Rediriger vers login si non connecté
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: '#0a0e27',
        color: '#ffffff'
      }}>
        Chargement...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="wa-container">
      {/* Header */}
      <header className="wa-header">
        <div className="header-top">
          <button className="header-btn menu-btn" onClick={() => { setJoinModalMode('choice'); setShowJoinModal(true); }} style={{ display: 'none' }} aria-hidden>
            <IconMenu size={20} />
          </button>
          <h1 className="header-title">Discussions</h1>
          <div className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {userId && <Wallet userId={userId} username={username} userEmail={user?.email || userProfile?.email} />}
            </div>
          </div>
        </div>
        <div className="ad-bar">
          <span className="ad-bar-label">Espace publicitaire</span>
        </div>
      </header>

      {/* Public Rooms Section */}
      {currentFilter === 'all' && (
        <div className="public-rooms-section">
          <div className="public-room-grid">
            {allChats
              .filter(chat => chat.id.startsWith('public_'))
              .map((chat) => {
                const iconKey = chat.iconKey || 'globeAlt';
                const PublicIcon = iconKey === 'aes' ? IconAes : iconKey === 'cemac' ? IconCemac : iconKey === 'uemoa' ? IconUemoa : iconKey === 'globe' ? IconGlobe : iconKey === 'handshake' ? IconHandshake : iconKey === 'briefcase' ? IconBriefcase : IconGlobeAlt;
                return (
                  <button
                    key={chat.id}
                    className="public-room-btn"
                    onClick={() => handleRejoinRoom(chat)}
                  >
                    <span><PublicIcon size={24} /></span>
                    <span>{chat.room.name || chat.name}</span>
                    <small>{chat.room.description || ''}</small>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Modal unique : Créer / Rejoindre une discussion */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => { setShowJoinModal(false); setJoinModalMode('choice'); setModalMessage(null); }}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            {joinModalMode === 'choice' && (
              <>
                <h3 className="modal-title"><IconClipboard size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Discussion</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  <button
                    type="button"
                    className="modal-btn modal-btn-choice"
                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => setJoinModalMode('create')}
                  >
                    <IconLock size={20} /> Créer une discussion privée
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-choice"
                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => setJoinModalMode('join')}
                  >
                    <IconClipboard size={20} /> Rejoindre une discussion
                  </button>
                </div>
                <button className="modal-btn cancel" style={{ marginTop: 20 }} onClick={() => setShowJoinModal(false)}>
                  Fermer
                </button>
              </>
            )}

            {joinModalMode === 'create' && (
              <>
                <h3 className="modal-title"><IconLock size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Créer une discussion privée</h3>
                {modalMessage && (
                  <div className={`modal-message ${modalMessage.type}`} style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, fontSize: 14, background: modalMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: modalMessage.type === 'error' ? '#ef4444' : '#22c55e' }}>
                    {modalMessage.text}
                  </div>
                )}
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
                  <button className="modal-btn cancel" onClick={() => { setJoinModalMode('choice'); setRoomName(''); setRoomPassword(''); }}>
                    Retour
                  </button>
                  <button className="modal-btn confirm" onClick={handleCreatePrivateRoomWithPassword}>
                    Créer
                  </button>
                </div>
              </>
            )}

            {joinModalMode === 'join' && (
              <>
                <h3 className="modal-title"><IconClipboard size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Rejoindre une discussion</h3>
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
                    <button className="modal-btn confirm" onClick={() => handleJoinByLink()}>
                      Rejoindre
                    </button>
                  </div>
                </div>
                <div className="join-section-modal">
                  <h4><IconLock size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Rejoindre une discussion privée</h4>
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
                  <button className="modal-btn confirm" onClick={() => handleJoinPrivateRoom()}>
                    Rejoindre
                  </button>
                </div>
                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="modal-btn cancel" onClick={() => setJoinModalMode('choice')}>
                    Retour
                  </button>
                  <button className="modal-btn cancel" onClick={() => setShowJoinModal(false)}>
                    Fermer
                  </button>
                </div>
              </>
            )}
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
            {linkCopied && <p style={{ marginBottom: 12, fontSize: 14, color: '#22c55e' }}>Lien copié !</p>}
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
    </div>
  );
}
