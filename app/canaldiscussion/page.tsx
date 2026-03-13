'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Wallet from '@/components/Wallet';
import { IconGlobeAlt, IconMoreVertical } from '@/components/Icons';
import { getCountryFromRoomName, getCountryFlagUrl } from '@/lib/countries';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { getPublicRoomsCache, isPublicRoomsCacheValid, setPublicRoomsCache } from '@/lib/public-rooms-client-cache';
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

  // Lire une fois le cache au moment de l'initialisation pour éviter un flash de squelette
  const cached = getPublicRoomsCache();
  const hasValidCache = !!cached && isPublicRoomsCacheValid();

  const [allChats, setAllChats] = useState<ChatItem[]>(() => {
    if (!hasValidCache || !cached) return [];
    // On reconstruit une version minimale des chats pour l'affichage immédiat.
    return cached.rooms.map((publicRoom) => ({
      id: publicRoom.id,
      name: publicRoom.name,
      type: 'group' as const,
      isPrivate: false,
      lastMessage: '', // sera enrichi ensuite par getLastMessage
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
    }));
  });
  const [lastMessagesCache, setLastMessagesCache] = useState<{ [key: string]: string }>({});
  const [adCanalHtml, setAdCanalHtml] = useState<string>('');
  const [adCanalNativeHtml, setAdCanalNativeHtml] = useState<string>('');
  const [sectionLoaded, setSectionLoaded] = useState<{ ad: boolean; discussions: boolean }>({
    ad: false,
    discussions: hasValidCache,
  });
  const [categoriesCanal, setCategoriesCanal] = useState<{ id: string; name: string; order: number }[]>(() => {
    if (!hasValidCache || !cached) return [];
    return cached.categories;
  });
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [discussionsRetryCount, setDiscussionsRetryCount] = useState(0);
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

  // Injection de la pub : HTML + exécution des scripts (pour affichage), puis sandbox des iframes (évite redirections)
  const runAdInjection = useCallback((container: HTMLDivElement | null) => {
    if (!container || !adCanalHtml.trim()) return;
    container.innerHTML = adCanalHtml;
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      if (oldScript.src) newScript.src = oldScript.src;
      else newScript.textContent = oldScript.textContent || '';
      if (oldScript.async) newScript.async = true;
      if (oldScript.defer) newScript.defer = true;
      container.appendChild(newScript);
    });
    scripts.forEach((s) => s.remove());
    sandboxAdIframes(container);
    setTimeout(() => sandboxAdIframes(container), 2000);
  }, [adCanalHtml, sandboxAdIframes]);

  // Callback ref : injecter une seule fois quand le conteneur pub est monté
  const setAdBarRef = useCallback((el: HTMLDivElement | null) => {
    (adBarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el && adCanalHtml.trim() && !el.querySelector('iframe')) {
      runAdInjection(el);
    }
  }, [adCanalHtml, runAdInjection]);

  // Pub native : HTML + exécution des scripts, puis sandbox des iframes
  const runAdNativeInjection = useCallback((container: HTMLDivElement | null) => {
    if (!container || !adCanalNativeHtml.trim()) return;
    container.innerHTML = adCanalNativeHtml;
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      if (oldScript.src) newScript.src = oldScript.src;
      else newScript.textContent = oldScript.textContent || '';
      if (oldScript.async) newScript.async = true;
      if (oldScript.defer) newScript.defer = true;
      container.appendChild(newScript);
    });
    scripts.forEach((s) => s.remove());
    sandboxAdIframes(container);
    setTimeout(() => sandboxAdIframes(container), 2000);
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


  // Charger les discussions (salons publics uniquement). Timeout pour éviter écran vide sur WebView (ex. iPad).
  useEffect(() => {
    const DISCUSSIONS_TIMEOUT_MS = 10000;

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

          setPublicRoomsCache(publicRooms, categoriesList);
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

    const timeoutId = setTimeout(() => {
      setSectionLoaded(prev => {
        if (prev.discussions) return prev;
        return { ...prev, discussions: true };
      });
    }, DISCUSSIONS_TIMEOUT_MS);

    loadDiscussions().finally(() => {
      clearTimeout(timeoutId);
    });
  }, [discussionsRetryCount]);

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

  // Quand les discussions sont prêtes, on signale à l'écran de splash que la page principale est prête.
  // On ne dépend pas de la pub pour éviter écran vide si l'API pub est lente (ex. WebView iPad).
  useEffect(() => {
    if (!sectionLoaded.discussions) return;
    if (typeof window !== 'undefined' && !window.sessionStorage.getItem('legrinpoMainScreenReady')) {
      window.sessionStorage.setItem('legrinpoMainScreenReady', '1');
    }
  }, [sectionLoaded.discussions]);

  return (
    <div className="wa-container">
      {/* Header */}
      <header className="wa-header">
        <div className="header-top">
          <div className="header-title-row">
            <h1 className="header-title">Discussions</h1>
            <button
              type="button"
              className="header-menu-dots"
              onClick={() => setWalletModalOpen(true)}
              aria-label="Ouvrir le portefeuille"
            >
              <IconMoreVertical size={22} />
            </button>
          </div>
          <div className="header-actions">
            {userId && (
              <Wallet
                userId={userId}
                username={username}
                userEmail={user?.email || userProfile?.email}
                showTrigger={true}
                openInModal={walletModalOpen}
                onCloseModal={() => setWalletModalOpen(false)}
              />
            )}
          </div>
        </div>
        {adCanalHtml ? (
          <div className="ad-bar">
            <div ref={setAdBarRef} className="ad-bar-content" />
          </div>
        ) : null}
      </header>

      {/* Public Rooms Section — squelette pendant le tout premier chargement uniquement */}
      {(() => {
        // On n'affiche le squelette que lorsqu'aucune discussion n'est encore disponible.
        // Si du contenu est déjà présent (ex. navigation retour, état restauré, future hydratation avec données),
        // on affiche directement la grille sans passer par le squelette.
        if (!sectionLoaded.discussions && allChats.length === 0) {
          return (
            <div className="public-rooms-section public-rooms-skeleton" aria-busy="true" aria-label="Chargement des discussions">
              <div className="public-room-grid many-cases">
                <div className="skeleton-card skeleton-ad-slot" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton-card skeleton-category">
                    <span className="skeleton-icon" />
                    <span className="skeleton-line skeleton-title" />
                    <span className="skeleton-line skeleton-sub" />
                  </div>
                ))}
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
          {/* État vide : aucune discussion chargée — message + réessayer */}
          {totalCards === 1 && publicRooms.length === 0 && (
            <div className="public-rooms-empty">
              <p className="public-rooms-empty-text">Aucune discussion pour le moment.</p>
              <button
                type="button"
                className="public-rooms-retry-btn"
                onClick={() => {
                  setSectionLoaded(prev => ({ ...prev, discussions: false }));
                  setDiscussionsRetryCount(c => c + 1);
                }}
              >
                Réessayer
              </button>
            </div>
          )}
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
