'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Wallet from '@/components/Wallet';
import { IconGlobeAlt, IconArrowLeft, IconMoreVertical } from '@/components/Icons';
import { getCountryFromRoomName, getCountryFlagUrl } from '@/lib/countries';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import '../../../globals.css';
import '../../canaldiscussion-wa.css';

interface RoomItem {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
}

const SANS_CATEGORIE_ID = 'sans-categorie';

export default function CanalCategoriePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { user, userProfile, loading: authLoading } = useAuth();
  const username = userProfile?.username || userProfile?.displayName || user?.displayName || 'Membre';
  const userId = userProfile?.uid || user?.uid || (user?.id ? `db_${user.id}` : `temp_${Date.now()}`);

  const [categoryName, setCategoryName] = useState<string>('');
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adCanalHtml, setAdCanalHtml] = useState<string>('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const adBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/ad/canal')
      .then((res) => res.json())
      .then((data) => {
        setAdCanalHtml(data?.adCanalDiscussion ?? '');
      })
      .catch(() => setAdCanalHtml(''));
  }, []);

  // Sandbox des iframes pub : empêche la redirection de la page (top.location) par le contenu des iframes
  const sandboxAdIframes = useCallback((container: HTMLDivElement) => {
    container.querySelectorAll('iframe').forEach((iframe) => {
      iframe.setAttribute('sandbox', 'allow-scripts allow-popups');
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

  const setAdBarRef = useCallback((el: HTMLDivElement | null) => {
    (adBarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el && adCanalHtml.trim() && !el.querySelector('iframe')) {
      runAdInjection(el);
    }
  }, [adCanalHtml, runAdInjection]);

  const loadCategoryAndRooms = useCallback(async () => {
    if (!id || !db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (id === SANS_CATEGORIE_ID) {
        setCategoryName('Sans catégorie');
        const roomsRef = collection(db, 'rooms');
        const q = query(roomsRef, where('type', '==', 'public'));
        const snapshot = await getDocs(q);
        const list: RoomItem[] = snapshot.docs.flatMap((docSnap) => {
          const d = docSnap.data();
          if (d.categoryId != null && d.categoryId !== '') return [];
          return [{
            id: docSnap.id,
            name: (d.name as string) || docSnap.id,
            description: (d.description as string) || '',
            categoryId: d.categoryId as string | undefined,
          }];
        });
        setRooms(list);
      } else {
        const catRef = doc(db, 'categories', id);
        const catSnap = await getDoc(catRef);
        if (!catSnap.exists()) {
          setError('Catégorie introuvable');
          setRooms([]);
          setLoading(false);
          return;
        }
        const catName = String(catSnap.data()?.name ?? '');
        setCategoryName(catName);

        const roomsRef = collection(db, 'rooms');
        const q = query(roomsRef, where('type', '==', 'public'), where('categoryId', '==', id));
        const snapshot = await getDocs(q);
        const globalName = `Global ${catName}`;
        const list: RoomItem[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: (d.name as string) || docSnap.id,
              description: (d.description as string) || '',
              categoryId: d.categoryId as string | undefined,
            };
          })
          .sort((a, b) => {
            // 0 = Global (en premier), 1 = salons créés à la main (après Global, avant pays), 2 = salons pays (en dernier)
            const order = (room: RoomItem) => {
              if (room.name === globalName) return 0;
              if (getCountryFromRoomName(room.name)) return 2;
              return 1;
            };
            const oa = order(a);
            const ob = order(b);
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name);
          });
        setRooms(list);
      }
    } catch (err) {
      console.error('Erreur chargement catégorie:', err);
      setError('Erreur de chargement');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCategoryAndRooms();
  }, [loadCategoryAndRooms]);

  const handleOpenRoom = useCallback(
    (room: RoomItem) => {
      const params = new URLSearchParams({ room: room.id, roomName: room.name });
      const returnTo = `/canaldiscussion/categorie/${id}`;
      params.set('returnTo', returnTo);
      router.push(`/chat?${params.toString()}`);
    },
    [router, id]
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="wa-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e27', color: '#fff' }}>
        Chargement...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="wa-container">
      <header className="wa-header">
        <div className="header-top">
          <div className="header-title-row">
            <h1 className="header-title">{categoryName || '…'}</h1>
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
      </header>

      <div className="ad-bar">
        {adCanalHtml ? (
          <div ref={setAdBarRef} className="ad-bar-content" />
        ) : (
          <span className="ad-bar-label">Espace publicitaire</span>
        )}
      </div>

      <div className="categorie-back-bar">
        <Link
          href="/canaldiscussion"
          className="categorie-back-link"
          aria-label="Retour aux catégories"
        >
          <IconArrowLeft size={20} />
          <span>Retour</span>
        </Link>
      </div>

      <main className="public-rooms-section">
        {loading && (
          <div className="public-rooms-loading">
            <span className="public-rooms-loading-text">Chargement...</span>
          </div>
        )}
        {error && (
          <div className="admin-error" style={{ margin: 16, padding: 12, background: 'rgba(239,68,68,0.15)', borderRadius: 8, color: '#ef4444' }}>
            {error}
          </div>
        )}
        {!loading && !error && rooms.length === 0 && (
          <div className="public-rooms-loading">
            <span className="public-rooms-loading-text">Aucun groupe dans cette catégorie.</span>
          </div>
        )}
        {!loading && !error && rooms.length > 0 && (
          <div className={`public-room-grid${rooms.length >= 6 ? ' many-cases' : ''}`}>
            {rooms.map((room) => {
              const country = getCountryFromRoomName(room.name);
              const flagUrl = country ? getCountryFlagUrl(country, 40) : '';
              return (
                <button
                  key={room.id}
                  type="button"
                  className="public-room-btn"
                  onClick={() => handleOpenRoom(room)}
                >
                  <span className="public-room-icon">
                    {flagUrl ? (
                      <img src={flagUrl} alt="" />
                    ) : (
                      <IconGlobeAlt size={24} />
                    )}
                  </span>
                  <span>{room.name}</span>
                  <small>{room.description || ''}</small>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
