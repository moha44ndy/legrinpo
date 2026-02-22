'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Wallet from '@/components/Wallet';
import { IconGlobeAlt } from '@/components/Icons';
import { getCountryFromRoomName, getCountryFlagUrl } from '@/lib/countries';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
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
  room: { id: string; name: string; description?: string; type: string; createdAt?: string; categoryId?: string };
}

export default function CanalDiscussionPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const username = userProfile?.username || userProfile?.displayName || user?.displayName || 'Membre';
  // Utiliser uid de userProfile ou user, ou générer un ID temporaire
  const userId = userProfile?.uid || user?.uid || (user?.id ? `db_${user.id}` : `temp_${Date.now()}`);

  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [lastMessagesCache, setLastMessagesCache] = useState<{ [key: string]: string }>({});
  const [adCanalHtml, setAdCanalHtml] = useState<string>('');
  const [adCanalNativeHtml, setAdCanalNativeHtml] = useState<string>('');
  const [sectionLoaded, setSectionLoaded] = useState<{ ad: boolean; discussions: boolean }>({ ad: false, discussions: false });
  const [categoriesCanal, setCategoriesCanal] = useState<{ id: string; name: string; order: number }[]>([]);
  const adBarRef = useRef<HTMLDivElement>(null);
  const adNativeBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ad/canal')
      .then((res) => res.json())
      .then((data) => {
        setAdCanalHtml(data?.adCanalDiscussion ?? '');
        setAdCanalNativeHtml(data?.adCanalNative ?? '');
        setSectionLoaded(prev => ({ ...prev, ad: true }));
      })
      .catch(() => {
        setAdCanalHtml('');
        setAdCanalNativeHtml('');
        setSectionLoaded(prev => ({ ...prev, ad: true }));
      });
  }, []);

  // Sandbox des iframes pub : empêche la redirection de la page (top.location) par le contenu des iframes
  const sandboxAdIframes = useCallback((container: HTMLDivElement) => {
    container.querySelectorAll('iframe').forEach((iframe) => {
      iframe.setAttribute('sandbox', 'allow-scripts allow-popups');
      // Pas de allow-top-navigation : le contenu de l'iframe ne peut pas changer l'URL de votre site
    });
  }, []);

  // Injection de la pub : HTML uniquement, sans exécuter les scripts ; iframes sandboxées
  const runAdInjection = useCallback((container: HTMLDivElement | null) => {
    if (!container || !adCanalHtml.trim()) return;
    container.innerHTML = adCanalHtml;
    sandboxAdIframes(container);
  }, [adCanalHtml, sandboxAdIframes]);

  // Callback ref : injecter une seule fois quand le conteneur pub est monté
  const setAdBarRef = useCallback((el: HTMLDivElement | null) => {
    (adBarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el && adCanalHtml.trim() && !el.querySelector('iframe')) {
      runAdInjection(el);
    }
  }, [adCanalHtml, runAdInjection]);

  // Pub native : HTML uniquement, sans exécuter les scripts ; iframes sandboxées
  const runAdNativeInjection = useCallback((container: HTMLDivElement | null) => {
    if (!container || !adCanalNativeHtml.trim()) return;
    container.innerHTML = adCanalNativeHtml;
    sandboxAdIframes(container);
  }, [adCanalNativeHtml, sandboxAdIframes]);

  const setAdNativeBarRef = useCallback((el: HTMLDivElement | null) => {
    (adNativeBarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el && adCanalNativeHtml.trim() && !el.querySelector('iframe')) {
      runAdNativeInjection(el);
    }
  }, [adCanalNativeHtml, runAdNativeInjection]);

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

  // Charger les discussions (salons publics uniquement)
  useEffect(() => {
    const loadDiscussions = async () => {
      const chats: ChatItem[] = [];

      // Salons publics : Firebase (rooms) + catégories pour regroupement
      let publicRooms: { id: string; name: string; description: string; createdAt: number; categoryId?: string }[] = [];
      let categoriesList: { id: string; name: string; order: number }[] = [];
      if (db) {
        try {
          const [roomsSnap, categoriesSnap] = await Promise.all([
            getDocs(query(collection(db, 'rooms'), where('type', '==', 'public'))),
            getDocs(query(collection(db, 'categories'), orderBy('order'))),
          ]);
          categoriesList = categoriesSnap.docs
            .map((doc) => {
              const d = doc.data();
              return { id: doc.id, name: String(d.name ?? ''), order: Number(d.order ?? 0) };
            })
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
          setCategoriesCanal(categoriesList);
          publicRooms = roomsSnap.docs
            .map((doc) => {
              const d = doc.data();
              const raw = d.createdAt;
              const createdAt =
                raw && typeof raw === 'object' && typeof (raw as { toMillis?: () => number }).toMillis === 'function'
                  ? (raw as { toMillis: () => number }).toMillis()
                  : raw != null
                    ? new Date(raw as string | number).getTime()
                    : 0;
              return {
                id: doc.id,
                name: (d.name as string) || doc.id,
                description: (d.description as string) || '',
                createdAt,
                categoryId: d.categoryId as string | undefined,
              };
            })
            .sort((a, b) => a.createdAt - b.createdAt);
        } catch (err) {
          console.error('Erreur chargement salons publics Firebase:', err);
        }
      }

      // Charger les derniers messages en parallèle (au lieu d'un par un)
      const publicChats = await Promise.all(
        publicRooms.map(async (publicRoom) => {
          const lastMessage = await getLastMessage(publicRoom.id);
          return {
            id: publicRoom.id,
            name: publicRoom.name,
            type: 'group' as const,
            isPrivate: false,
            lastMessage,
            timestamp: new Date().toISOString(),
            avatar: { char: (publicRoom.name || '?').charAt(0), color: '#d32f2f' },
            room: {
              id: publicRoom.id,
              name: publicRoom.name,
              description: publicRoom.description || '',
              type: 'public' as const,
              createdAt: new Date().toISOString(),
              categoryId: publicRoom.categoryId,
            },
          };
        })
      );
      chats.push(...publicChats);

      setAllChats(chats);
      setSectionLoaded(prev => ({ ...prev, discussions: true }));
    };

    loadDiscussions();
  }, []);

  const handleRejoinRoom = (chat: ChatItem) => {
    const params = new URLSearchParams({ room: chat.room.id });
    if (chat.room.name) params.set('roomName', chat.room.name);
    router.push(`/chat?${params.toString()}`);
  };

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
          <h1 className="header-title">Discussions</h1>
          <div className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {userId && <Wallet userId={userId} username={username} userEmail={user?.email || userProfile?.email} />}
            </div>
          </div>
        </div>
        <div className="ad-bar">
          {adCanalHtml ? (
            <div ref={setAdBarRef} className="ad-bar-content" />
          ) : (
            <span className="ad-bar-label">Espace publicitaire</span>
          )}
        </div>
      </header>

      {/* Public Rooms Section — Chargement... puis grille (bannière native + cases) */}
      {(() => {
        const ready = sectionLoaded.ad && sectionLoaded.discussions;
        if (!ready) {
          return (
            <div className="public-rooms-section">
              <div className="public-rooms-loading">
                <span className="public-rooms-loading-text">Chargement...</span>
              </div>
            </div>
          );
        }
        const publicRooms = allChats.filter(chat => chat.id.startsWith('public_'));
        const byCategory = new Map<string, typeof publicRooms>();
        const noneKey = '__none__';
        for (const chat of publicRooms) {
          const key = chat.room.categoryId ?? noneKey;
          if (!byCategory.has(key)) byCategory.set(key, []);
          byCategory.get(key)!.push(chat);
        }
        const hasUncategorized = byCategory.has(noneKey) && (byCategory.get(noneKey)?.length ?? 0) > 0;
        // Exclure toute catégorie "sans-categorie" des cases ; "Sans catégorie" (salons sans categoryId) s'affiche toujours en dernier
        const categoryCards = categoriesCanal.filter(
          (cat) => cat.id !== 'sans-categorie' && (byCategory.get(cat.id)?.length ?? 0) > 0
        );
        const totalCards = 1 + categoryCards.length + (hasUncategorized ? 1 : 0); /* 1 = bannière */
        const manyCases = totalCards >= 6;
        return (
        <div className="public-rooms-section">
          {/* Même ligne : bannière native en 1ère position, puis cases catégories */}
          <div className={`public-room-grid${manyCases ? ' many-cases' : ''}`}>
            <div className="public-room-btn native-ad-slot" aria-label="Publicité">
              <span className="native-ad-label" aria-hidden="true">Pub</span>
              {adCanalNativeHtml ? (
                <div ref={setAdNativeBarRef} className="native-ad-inner" />
              ) : (
                <span className="native-ad-placeholder">Bannière native</span>
              )}
            </div>
            {categoryCards.map((cat) => {
              const count = byCategory.get(cat.id)?.length ?? 0;
              return (
                <Link
                  key={cat.id}
                  href={`/canaldiscussion/categorie/${cat.id}`}
                  className="public-room-btn public-category-card"
                  aria-label={`${cat.name}, ${count} groupe${count !== 1 ? 's' : ''}`}
                >
                  <span><IconGlobeAlt size={24} /></span>
                  <span>{cat.name}</span>
                  <small>{count} groupe{count !== 1 ? 's' : ''}</small>
                </Link>
              );
            })}
            {/* Sans catégorie en dernière position uniquement si elle contient au moins 1 groupe */}
            {hasUncategorized && (
              <Link
                href="/canaldiscussion/categorie/sans-categorie"
                className="public-room-btn public-category-card public-category-card-last"
                aria-label={`Sans catégorie, ${byCategory.get(noneKey)!.length} groupe${byCategory.get(noneKey)!.length !== 1 ? 's' : ''}`}
              >
                <span><IconGlobeAlt size={24} /></span>
                <span>Sans catégorie</span>
                <small>{byCategory.get(noneKey)!.length} groupe{byCategory.get(noneKey)!.length !== 1 ? 's' : ''}</small>
              </Link>
            )}
          </div>
          {/* Fallback : aucune catégorie, afficher tous les salons en grille directe */}
          {categoriesCanal.length === 0 && !hasUncategorized && publicRooms.length > 0 && (
            <div className="public-rooms-category-block">
              <div className={`public-room-grid${publicRooms.length >= 6 ? ' many-cases' : ''}`}>
                {publicRooms.map((chat) => {
                  const roomName = chat.room.name || chat.name;
                  const country = getCountryFromRoomName(roomName);
                  const flagUrl = country ? getCountryFlagUrl(country, 40) : '';
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      className="public-room-btn"
                      onClick={() => handleRejoinRoom(chat)}
                    >
                      <span className="public-room-icon">
                        {flagUrl ? (
                          <img src={flagUrl} alt="" />
                        ) : (
                          <IconGlobeAlt size={24} />
                        )}
                      </span>
                      <span>{roomName}</span>
                      <small>{chat.room.description || ''}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
