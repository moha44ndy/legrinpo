'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import '../globals.css';
import './admin.css';

const currentUserIdsMatch = (userId: number, currentUser: { id?: number } | null): boolean =>
  currentUser != null && Number(currentUser.id) === Number(userId);

interface AdminStats {
  users: number;
  wallets: number;
  transactions: number;
  rooms: number;
  totalBalance: number;
}

interface AdminUser {
  id: number;
  uid: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isDisabled?: boolean;
  createdAt: string;
}

interface AdminRoom {
  id: number | string; // number (legacy Supabase) ou string roomId (Firebase)
  roomId: string;
  name: string;
  description: string;
  type: string;
  createdAt: string;
}

type AdminTab = 'stats' | 'users' | 'rooms' | 'analytics' | 'transactions' | 'withdrawals' | 'settings' | 'logs';

interface SiteSettings {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementTitle: string;
  announcementBody: string;
  announcementLink: string;
  announcementVisible: boolean;
  pageCgu: string;
  pageFaq: string;
  pageAbout: string;
}

interface AnalyticsData {
  registrations: { date: string; count: number }[];
  messagesByPeriod: number;
  activeRooms: { roomId: string; name: string; count: number }[];
  balanceDistribution: { range: string; count: number }[];
}

interface AdminTransaction {
  id: number;
  userId: number;
  email: string;
  username: string;
  type: string;
  amount: number;
  reason: string | null;
  roomId: string | null;
  createdAt: string;
}

interface AdminWithdrawal {
  id: number;
  userId: number;
  email: string;
  username: string;
  amount: number;
  method: string;
  country: string;
  phoneOrIban: string;
  fullName: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  note: string | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SiteSettings>({
    siteName: '',
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementTitle: '',
    announcementBody: '',
    announcementLink: '',
    announcementVisible: false,
    pageCgu: '',
    pageFaq: '',
    pageAbout: '',
  });
  const [userSearch, setUserSearch] = useState('');
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ username: '', isDisabled: false });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [roomFormAdd, setRoomFormAdd] = useState({ roomId: '', name: '', description: '' });
  const [addRoomSaving, setAddRoomSaving] = useState(false);
  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: '', description: '' });
  const [roomEditSaving, setRoomEditSaving] = useState(false);
  const [roomEditError, setRoomEditError] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<number | string | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [transactionsList, setTransactionsList] = useState<AdminTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [withdrawalsList, setWithdrawalsList] = useState<AdminWithdrawal[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);
  const [withdrawalUpdatingId, setWithdrawalUpdatingId] = useState<number | null>(null);
  const [loginLogs, setLoginLogs] = useState<{ id: number; userId: number | null; email: string; ip: string | null; createdAt: string }[]>([]);
  const [actionLogs, setActionLogs] = useState<{ id: number; adminEmail: string; action: string; targetType: string | null; targetId: string | null; details: string | null; createdAt: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur chargement');
        return;
      }
      if (data.success && data.stats) setStats(data.stats);
    } catch (e) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) {
        setUsersError(data.error || 'Erreur chargement');
        return;
      }
      if (data.success && data.users) setUsers(data.users);
    } catch (e) {
      setUsersError('Erreur réseau');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!(user as { isAdmin?: boolean }).isAdmin) {
      router.replace('/canaldiscussion');
      return;
    }
    fetchStats();
  }, [user, authLoading, router, fetchStats]);

  useEffect(() => {
    if (tab === 'users' && user) fetchUsers();
  }, [tab, user, fetchUsers]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (!res.ok) {
        setSettingsError(data.error || 'Erreur chargement');
        return;
      }
      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);
        setSettingsForm({
          siteName: s.siteName ?? '',
          maintenanceMode: !!s.maintenanceMode,
          maintenanceMessage: s.maintenanceMessage ?? '',
          announcementTitle: s.announcementTitle ?? '',
          announcementBody: s.announcementBody ?? '',
          announcementLink: s.announcementLink ?? '',
          announcementVisible: !!s.announcementVisible,
          pageCgu: s.pageCgu ?? '',
          pageFaq: s.pageFaq ?? '',
          pageAbout: s.pageAbout ?? '',
        });
      }
    } catch (e) {
      setSettingsError('Erreur réseau');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'settings' && user) fetchSettings();
  }, [tab, user, fetchSettings]);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await fetch('/api/admin/rooms');
      const data = await res.json();
      if (!res.ok) {
        setRoomsError(data.error || 'Erreur chargement');
        return;
      }
      if (data.success && data.rooms) setRooms(data.rooms);
      else setRooms([]);
    } catch (e) {
      setRoomsError('Erreur réseau');
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'rooms' && user) fetchRooms();
  }, [tab, user, fetchRooms]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/admin/stats/advanced?period=${analyticsPeriod}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setAnalyticsData(data.data);
      } else {
        setAnalyticsData({ registrations: [], messagesByPeriod: 0, activeRooms: [], balanceDistribution: [] });
        setAnalyticsError(data.error || 'Erreur chargement des statistiques');
      }
    } catch (e) {
      setAnalyticsData({ registrations: [], messagesByPeriod: 0, activeRooms: [], balanceDistribution: [] });
      setAnalyticsError('Erreur réseau');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod]);

  useEffect(() => {
    if (tab === 'analytics' && user) fetchAnalytics();
  }, [tab, user, fetchAnalytics]);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch('/api/admin/transactions?limit=100');
      const data = await res.json();
      if (res.ok && data.success && data.transactions) setTransactionsList(data.transactions);
      else setTransactionsList([]);
    } catch {
      setTransactionsList([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'transactions' && user) fetchTransactions();
  }, [tab, user, fetchTransactions]);

  const fetchWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const res = await fetch('/api/admin/withdrawals');
      const data = await res.json();
      if (res.ok && data.success && data.withdrawals) setWithdrawalsList(data.withdrawals);
      else setWithdrawalsList([]);
    } catch {
      setWithdrawalsList([]);
    } finally {
      setWithdrawalsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'withdrawals' && user) fetchWithdrawals();
  }, [tab, user, fetchWithdrawals]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const [loginsRes, actionsRes] = await Promise.all([
        fetch('/api/admin/logs/logins?limit=100'),
        fetch('/api/admin/logs/actions?limit=100'),
      ]);
      const loginsData = await loginsRes.json();
      const actionsData = await actionsRes.json();
      if (loginsRes.ok && loginsData.success && loginsData.logins) setLoginLogs(loginsData.logins);
      else setLoginLogs([]);
      if (actionsRes.ok && actionsData.success && actionsData.actions) setActionLogs(actionsData.actions);
      else setActionLogs([]);
    } catch {
      setLoginLogs([]);
      setActionLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'logs' && user) fetchLogs();
  }, [tab, user, fetchLogs]);

  const processWithdrawal = useCallback(async (id: number, status: 'approved' | 'rejected') => {
    setWithdrawalUpdatingId(id);
    setWithdrawalsError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setWithdrawalsList((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    } catch (e: any) {
      setWithdrawalsError(e?.message || 'Erreur');
    } finally {
      setWithdrawalUpdatingId(null);
    }
  }, []);

  const openEditUser = useCallback((u: AdminUser) => {
    setEditUser(u);
    setEditForm({ username: u.username || u.displayName || '', isDisabled: !!u.isDisabled });
    setEditError(null);
  }, []);

  const saveEditUser = useCallback(async () => {
    if (!editUser) return;
    const isSelf = currentUserIdsMatch(editUser.id, user);
    if (editForm.isDisabled && isSelf) {
      setEditError('Vous ne pouvez pas désactiver votre propre compte.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editForm.username.trim() || undefined, isDisabled: editForm.isDisabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setUsers((prev) => prev.map((x) => (x.id === editUser.id ? { ...x, username: editForm.username.trim() || x.username, isDisabled: editForm.isDisabled } : x)));
      setEditUser(null);
    } catch (e: any) {
      setEditError(e?.message || 'Erreur mise à jour');
    } finally {
      setEditSaving(false);
    }
  }, [editUser, editForm, user]);

  const createRoom = useCallback(async () => {
    const roomId = roomFormAdd.roomId.trim().replace(/[^a-z0-9_-]/gi, '_');
    const name = roomFormAdd.name.trim();
    if (!roomId || !name) {
      setRoomsError('Identifiant et nom du salon sont requis.');
      return;
    }
    setAddRoomSaving(true);
    setRoomsError(null);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name,
          description: roomFormAdd.description.trim() || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setRooms((prev) => [...prev, data.room].filter(Boolean));
      setRoomFormAdd({ roomId: '', name: '', description: '' });
      setShowAddRoom(false);
    } catch (e: any) {
      setRoomsError(e?.message || 'Erreur création');
    } finally {
      setAddRoomSaving(false);
    }
  }, [roomFormAdd]);

  const openEditRoom = useCallback((r: AdminRoom) => {
    setEditRoom(r);
    setEditRoomForm({ name: r.name || '', description: r.description || '' });
    setRoomEditError(null);
  }, []);

  const saveEditRoom = useCallback(async () => {
    if (!editRoom) return;
    setRoomEditSaving(true);
    setRoomEditError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${editRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRoomForm.name.trim() || undefined,
          description: editRoomForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setRooms((prev) => prev.map((x) => (x.id === editRoom.id ? { ...x, ...data.room } : x)));
      setEditRoom(null);
    } catch (e: any) {
      setRoomEditError(e?.message || 'Erreur mise à jour');
    } finally {
      setRoomEditSaving(false);
    }
  }, [editRoom, editRoomForm]);

  const deleteRoom = useCallback(async (r: AdminRoom) => {
    if (!window.confirm(`Supprimer le salon "${r.name}" ? Les messages associés pourront être supprimés.`)) return;
    setDeletingRoomId(r.id);
    setRoomsError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${r.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setRooms((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) {
      setRoomsError(e?.message || 'Erreur suppression');
    } finally {
      setDeletingRoomId(null);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: settingsForm.siteName.trim() || 'Plateforme de Discussion',
          maintenanceMode: settingsForm.maintenanceMode,
          maintenanceMessage: settingsForm.maintenanceMessage.trim() || '',
          announcementTitle: settingsForm.announcementTitle.trim(),
          announcementBody: settingsForm.announcementBody.trim(),
          announcementLink: settingsForm.announcementLink.trim(),
          announcementVisible: settingsForm.announcementVisible,
          pageCgu: settingsForm.pageCgu.trim(),
          pageFaq: settingsForm.pageFaq.trim(),
          pageAbout: settingsForm.pageAbout.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSettings(settingsForm);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (e: any) {
      setSettingsError(e?.message || 'Erreur enregistrement');
    } finally {
      setSettingsSaving(false);
    }
  }, [settingsForm]);

  const handleTabChange = useCallback((newTab: AdminTab) => {
    setTab(newTab);
    setError(null);
    setUsersError(null);
    setRoomsError(null);
    setWithdrawalsError(null);
    setSettingsError(null);
  }, []);

  const exportUsersCsv = useCallback(() => {
    const search = userSearch.trim().toLowerCase();
    const list = search
      ? users.filter(
          (u) =>
            u.email.toLowerCase().includes(search) ||
            (u.username || '').toLowerCase().includes(search) ||
            (u.displayName || '').toLowerCase().includes(search)
        )
      : users;
    const formatDateCsv = (s: string) => {
      if (!s) return '-';
      try {
        return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch {
        return s;
      }
    };
    const headers = ['email', 'pseudo', 'rôle', 'date d\'inscription'];
    const rows = list.map((u) => [
      u.email,
      u.username || u.displayName || '-',
      u.isAdmin ? 'Admin' : 'Membre',
      formatDateCsv(u.createdAt),
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utilisateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [users, userSearch]);

  const toggleAdmin = useCallback(async (u: AdminUser) => {
    setUpdatingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !u.isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: !x.isAdmin } : x)));
    } catch (e: any) {
      setUsersError(e?.message || 'Erreur mise à jour');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const deleteUser = useCallback(async (u: AdminUser) => {
    if (!window.confirm(`Supprimer l'utilisateur "${u.email}" ? Cette action est irréversible.`)) return;
    setDeletingId(u.id);
    setUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      setUsersError(e?.message || 'Erreur suppression');
    } finally {
      setDeletingId(null);
    }
  }, []);

  if (authLoading || (!user && !error)) {
    return (
      <div className="admin-loading">
        <span>Chargement...</span>
      </div>
    );
  }

  const formatNumber = (n: number) => n.toLocaleString('fr-FR');
  const formatBalance = (n: number) => `${formatNumber(Math.round(n * 100) / 100)} FCFA`;
  const formatDate = (s: string) => {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const filteredUsers = userSearch.trim()
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.displayName || '').toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;
  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-top">
            <Link href="/canaldiscussion" className="admin-back">
              Retour aux discussions
            </Link>
          </div>
          <h1 className="admin-title">Tableau de bord</h1>
          <p className="admin-subtitle">Gérez les utilisateurs, les statistiques et les paramètres de la plateforme.</p>
          <nav className="admin-tabs" aria-label="Sections du dashboard">
            <button
              type="button"
              className={`admin-tab ${tab === 'stats' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('stats')}
            >
              Statistiques
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'users' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('users')}
            >
              Utilisateurs
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'rooms' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('rooms')}
            >
              Salons fixes
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'analytics' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('analytics')}
            >
              Analytics
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'transactions' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('transactions')}
            >
              Transactions
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'withdrawals' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('withdrawals')}
            >
              Retraits
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'settings' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('settings')}
            >
              Paramètres
            </button>
            <button
              type="button"
              className={`admin-tab ${tab === 'logs' ? 'admin-tab-active' : ''}`}
              onClick={() => handleTabChange('logs')}
            >
              Journaux
            </button>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {tab === 'stats' && (
          <>
            {loading && !stats && !error && (
              <div className="admin-loading-inline">Chargement des statistiques...</div>
            )}
            {stats && (
              <>
                <p className="admin-stats-summary">
                  Vue d&apos;ensemble de la plateforme : {formatNumber(stats.users)} compte{stats.users !== 1 ? 's' : ''} utilisateur{stats.users !== 1 ? 's' : ''}, {formatNumber(stats.transactions)} transaction{stats.transactions !== 1 ? 's' : ''}.
                </p>
                <div className="admin-cards">
                  <article className="admin-card admin-card-users">
                    <div className="admin-card-body">
                      <span className="admin-card-label">Utilisateurs</span>
                      <span className="admin-card-value">{formatNumber(stats.users)}</span>
                    </div>
                  </article>
                  <article className="admin-card admin-card-wallets">
                    <div className="admin-card-body">
                      <span className="admin-card-label">Portefeuilles</span>
                      <span className="admin-card-value">{formatNumber(stats.wallets)}</span>
                    </div>
                  </article>
                  <article className="admin-card admin-card-transactions">
                    <div className="admin-card-body">
                      <span className="admin-card-label">Transactions</span>
                      <span className="admin-card-value">{formatNumber(stats.transactions)}</span>
                    </div>
                  </article>
                  <article className="admin-card admin-card-rooms">
                    <div className="admin-card-body">
                      <span className="admin-card-label">Salons</span>
                      <span className="admin-card-value">{formatNumber(stats.rooms)}</span>
                    </div>
                  </article>
                  <article className="admin-card admin-card-highlight">
                    <div className="admin-card-body">
                      <span className="admin-card-label">Solde total plateforme</span>
                      <span className="admin-card-value">{formatBalance(stats.totalBalance)}</span>
                    </div>
                  </article>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'users' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Utilisateurs</h2>
            {usersError && <div className="admin-error">{usersError}</div>}
            {usersLoading && users.length === 0 && (
              <div className="admin-loading-inline">Chargement de la liste...</div>
            )}
            {!usersLoading && users.length === 0 && !usersError && (
              <div className="admin-empty-state">
                <p className="admin-empty-state-title">Aucun utilisateur</p>
                <p className="admin-empty-state-desc">Les comptes apparaîtront ici après les premières inscriptions.</p>
              </div>
            )}
            {!usersLoading && users.length > 0 && (
              <>
                <div className="admin-users-toolbar">
                  <span className="admin-users-count">
                    {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
                    {adminCount > 0 && ` (${adminCount} admin${adminCount !== 1 ? 's' : ''})`}
                  </span>
                  <button type="button" className="admin-btn admin-btn-export" onClick={exportUsersCsv}>
                    Exporter CSV
                  </button>
                  <input
                    type="search"
                    className="admin-search"
                    placeholder="Rechercher par email ou pseudo..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    aria-label="Rechercher un utilisateur"
                  />
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Pseudo</th>
                        <th>Inscription</th>
                        <th>Rôle</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td><span className="admin-cell-email">{u.email}</span></td>
                        <td>{u.username || u.displayName || '-'}</td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          {u.isAdmin ? (
                            <span className="admin-badge admin-badge-admin">Admin</span>
                          ) : (
                            <span className="admin-badge admin-badge-user">Membre</span>
                          )}
                          {u.isDisabled && <span className="admin-badge admin-badge-disabled">Désactivé</span>}
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn-edit"
                              onClick={() => openEditUser(u)}
                              title="Modifier le pseudo / désactiver le compte"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className={`admin-btn ${u.isAdmin ? 'admin-btn-demote' : 'admin-btn-promote'}`}
                              onClick={() => toggleAdmin(u)}
                              disabled={updatingId === u.id || currentUserIdsMatch(u.id, user)}
                              title={u.isAdmin ? 'Retirer les droits admin' : 'Donner les droits admin'}
                            >
                              {updatingId === u.id ? '...' : u.isAdmin ? 'Retirer admin' : 'Mettre admin'}
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-delete"
                              onClick={() => deleteUser(u)}
                              disabled={deletingId === u.id || currentUserIdsMatch(u.id, user)}
                              title="Supprimer l'utilisateur"
                            >
                              {deletingId === u.id ? '...' : 'Supprimer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {userSearch.trim() && filteredUsers.length === 0 && (
                  <p className="admin-empty">Aucun résultat pour &quot;{userSearch.trim()}&quot;.</p>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'rooms' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Salons fixes</h2>
            <p className="admin-section-desc">Gérez les salons publics (créer, modifier, supprimer). Les salons privés ne sont pas affichés.</p>
            {roomsError && <div className="admin-error">{roomsError}</div>}
            <div className="admin-rooms-toolbar">
              <button
                type="button"
                className="admin-btn admin-btn-promote"
                onClick={() => setShowAddRoom((v) => !v)}
                aria-expanded={showAddRoom ? 'true' : 'false'}
              >
                {showAddRoom ? 'Annuler' : 'Ajouter un salon'}
              </button>
            </div>
            {showAddRoom && (
              <form
                className="admin-settings-form admin-room-form"
                onSubmit={(e) => { e.preventDefault(); createRoom(); }}
              >
                <label className="admin-settings-label">
                  Identifiant du salon (lettres, chiffres, tirets)
                  <input
                    type="text"
                    className="admin-settings-input"
                    value={roomFormAdd.roomId}
                    onChange={(e) => setRoomFormAdd((f) => ({ ...f, roomId: e.target.value }))}
                    placeholder="ex: public_mon_salon"
                    disabled={addRoomSaving}
                  />
                </label>
                <label className="admin-settings-label">
                  Nom affiché
                  <input
                    type="text"
                    className="admin-settings-input"
                    value={roomFormAdd.name}
                    onChange={(e) => setRoomFormAdd((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nom du salon"
                    disabled={addRoomSaving}
                  />
                </label>
                <label className="admin-settings-label">
                  Description (optionnel)
                  <textarea
                    className="admin-settings-input admin-settings-textarea"
                    value={roomFormAdd.description}
                    onChange={(e) => setRoomFormAdd((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description courte"
                    rows={2}
                    disabled={addRoomSaving}
                  />
                </label>
                <button type="submit" className="admin-btn admin-btn-save" disabled={addRoomSaving}>
                  {addRoomSaving ? 'Création...' : 'Créer le salon'}
                </button>
              </form>
            )}
            {roomsLoading && rooms.length === 0 && (
              <div className="admin-loading-inline">Chargement des salons...</div>
            )}
            {!roomsLoading && rooms.length === 0 && !roomsError && !showAddRoom && (
              <div className="admin-empty-state">
                <p className="admin-empty-state-title">Aucun salon fixe</p>
                <p className="admin-empty-state-desc">Cliquez sur &quot;Ajouter un salon&quot; pour en créer un.</p>
              </div>
            )}
            {!roomsLoading && rooms.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Créé le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <td><span className="admin-cell-email">{r.name || r.roomId || '-'}</span></td>
                        <td>{r.description || '-'}</td>
                        <td>{r.type || 'public'}</td>
                        <td>{formatDate(r.createdAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn-edit"
                              onClick={() => openEditRoom(r)}
                              title="Modifier le salon"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-delete"
                              onClick={() => deleteRoom(r)}
                              disabled={deletingRoomId === r.id}
                              title="Supprimer le salon"
                            >
                              {deletingRoomId === r.id ? '...' : 'Supprimer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'analytics' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Analytics</h2>
            <p className="admin-section-desc">Évolution des inscriptions, activité des messages et répartition des soldes.</p>
            <div className="admin-analytics-period">
              <span>Période :</span>
              {(['day', 'week', 'month'] as const).map((p) => (
                <button key={p} type="button" className={`admin-btn ${analyticsPeriod === p ? 'admin-tab-active' : ''}`} onClick={() => setAnalyticsPeriod(p)}>
                  {p === 'day' ? '24 h' : p === 'week' ? '7 jours' : '30 jours'}
                </button>
              ))}
            </div>
            {analyticsLoading && <div className="admin-loading-inline">Chargement des statistiques...</div>}
            {analyticsError && <div className="admin-error">{analyticsError}</div>}
            {!analyticsLoading && analyticsData && (
              <>
                <h3 className="admin-subsection-title">Inscriptions (par date)</h3>
                {analyticsData.registrations.length > 0 ? (
                  <div className="admin-chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={analyticsData.registrations}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,158,255,0.2)" />
                        <XAxis dataKey="date" stroke="#8b9dc3" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#8b9dc3" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#131b3d', border: '1px solid rgba(74,158,255,0.3)' }} labelStyle={{ color: '#e8ecf5' }} />
                        <Line type="monotone" dataKey="count" stroke="#4a9eff" strokeWidth={2} dot={{ fill: '#4a9eff' }} name="Inscriptions" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="admin-empty">Aucune inscription sur la période sélectionnée.</p>
                )}
                <h3 className="admin-subsection-title">Messages sur la période</h3>
                <p className="admin-stats-summary">{analyticsData.messagesByPeriod} message{analyticsData.messagesByPeriod !== 1 ? 's' : ''}</p>
                <h3 className="admin-subsection-title">Salons les plus actifs</h3>
                {analyticsData.activeRooms.length > 0 ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Salon</th><th>Messages</th></tr></thead>
                      <tbody>
                        {analyticsData.activeRooms.map((r) => (
                          <tr key={r.roomId}><td>{r.name || r.roomId}</td><td>{r.count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-empty">Aucun message sur la période.</p>
                )}
                <h3 className="admin-subsection-title">Répartition des soldes (portefeuilles)</h3>
                {analyticsData.balanceDistribution.some((b) => b.count > 0) ? (
                  <div className="admin-chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={analyticsData.balanceDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,158,255,0.2)" />
                        <XAxis dataKey="range" stroke="#8b9dc3" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#8b9dc3" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#131b3d', border: '1px solid rgba(74,158,255,0.3)' }} />
                        <Bar dataKey="count" fill="rgba(74,158,255,0.6)" name="Comptes" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="admin-empty">Aucun portefeuille ou aucune donnée.</p>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'transactions' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Dernières transactions</h2>
            {transactionsLoading && <div className="admin-loading-inline">Chargement...</div>}
            {!transactionsLoading && transactionsList.length === 0 && (
              <div className="admin-empty-state"><p className="admin-empty-state-title">Aucune transaction</p></div>
            )}
            {!transactionsLoading && transactionsList.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Date</th><th>Utilisateur</th><th>Type</th><th>Montant</th><th>Raison</th></tr>
                  </thead>
                  <tbody>
                    {transactionsList.map((t) => (
                      <tr key={t.id}>
                        <td>{formatDate(t.createdAt)}</td>
                        <td><span className="admin-cell-email">{t.email || t.username || t.userId}</span></td>
                        <td>{t.type === 'earn' ? 'Gain' : 'Dépense'}</td>
                        <td>{formatNumber(t.amount)} FCFA</td>
                        <td>{t.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'withdrawals' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Demandes de retrait</h2>
            {withdrawalsError && <div className="admin-error">{withdrawalsError}</div>}
            {withdrawalsLoading && <div className="admin-loading-inline">Chargement...</div>}
            {!withdrawalsLoading && withdrawalsList.length === 0 && (
              <div className="admin-empty-state"><p className="admin-empty-state-title">Aucune demande</p></div>
            )}
            {!withdrawalsLoading && withdrawalsList.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Date</th><th>Utilisateur</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {withdrawalsList.map((w) => (
                      <tr key={w.id}>
                        <td>{formatDate(w.createdAt)}</td>
                        <td><span className="admin-cell-email">{w.email}</span><br /><small>{w.fullName}</small></td>
                        <td>{formatNumber(w.amount)} FCFA</td>
                        <td>{w.method}</td>
                        <td>
                          <span className={`admin-badge ${w.status === 'pending' ? 'admin-badge-user' : w.status === 'approved' ? 'admin-badge-admin' : 'admin-badge-disabled'}`}>
                            {w.status === 'pending' ? 'En attente' : w.status === 'approved' ? 'Approuvée' : 'Refusée'}
                          </span>
                        </td>
                        <td>
                          {w.status === 'pending' && (
                            <div className="admin-row-actions">
                              <button type="button" className="admin-btn admin-btn-promote" onClick={() => processWithdrawal(w.id, 'approved')} disabled={withdrawalUpdatingId === w.id}>Approuver</button>
                              <button type="button" className="admin-btn admin-btn-delete" onClick={() => processWithdrawal(w.id, 'rejected')} disabled={withdrawalUpdatingId === w.id}>Refuser</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'logs' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Journaux</h2>
            <p className="admin-section-desc">Connexions et actions administrateur.</p>
            {logsLoading && <div className="admin-loading-inline">Chargement...</div>}
            {!logsLoading && (
              <>
                <h3 className="admin-subsection-title">Dernières connexions</h3>
                {loginLogs.length === 0 ? <p className="admin-empty">Aucune entrée.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Date</th><th>Email</th><th>IP</th></tr></thead>
                      <tbody>
                        {loginLogs.map((l) => (
                          <tr key={l.id}><td>{formatDate(l.createdAt)}</td><td>{l.email || '-'}</td><td>{l.ip || '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <h3 className="admin-subsection-title">Actions admin</h3>
                {actionLogs.length === 0 ? <p className="admin-empty">Aucune action.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Date</th><th>Admin</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
                      <tbody>
                        {actionLogs.map((a) => (
                          <tr key={a.id}>
                            <td>{formatDate(a.createdAt)}</td>
                            <td>{a.adminEmail}</td>
                            <td>{a.action}</td>
                            <td>{a.targetType}{a.targetId ? ` #${a.targetId}` : ''}</td>
                            <td>{a.details || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'settings' && (
          <section className="admin-section">
            <h2 className="admin-section-title">Paramètres du site</h2>
            <p className="admin-section-desc">Nom du site, maintenance, annonces et pages d&apos;info.</p>
            {settingsError && <div className="admin-error">{settingsError}</div>}
            {settingsSuccess && (
              <div className="admin-success">Les paramètres ont été enregistrés.</div>
            )}
            {settingsLoading && !settings && (
              <div className="admin-loading-inline">Chargement des paramètres...</div>
            )}
            {(!settingsLoading || settings) && (
              <form
                className="admin-settings-form"
                onSubmit={(e) => { e.preventDefault(); saveSettings(); }}
              >
                <label className="admin-settings-label">
                  Nom du site
                  <input
                    type="text"
                    className="admin-settings-input"
                    value={settingsForm.siteName}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, siteName: e.target.value }))}
                    placeholder="Plateforme de Discussion"
                    disabled={settingsSaving}
                  />
                </label>
                <label className="admin-settings-label admin-settings-check">
                  <input
                    type="checkbox"
                    checked={settingsForm.maintenanceMode}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, maintenanceMode: e.target.checked }))}
                    disabled={settingsSaving}
                  />
                  <span>Mode maintenance (désactive l&apos;accès au site pour les visiteurs)</span>
                </label>
                <label className="admin-settings-label">
                  Message de maintenance (affiché aux visiteurs si le mode maintenance est activé)
                  <textarea
                    className="admin-settings-input admin-settings-textarea"
                    value={settingsForm.maintenanceMessage}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
                    placeholder="Le site est actuellement en maintenance. Réessayez plus tard."
                    rows={3}
                    disabled={settingsSaving}
                  />
                </label>
                <h3 className="admin-subsection-title">Annonce / Bannière</h3>
                <label className="admin-settings-label admin-settings-check">
                  <input type="checkbox" checked={settingsForm.announcementVisible} onChange={(e) => setSettingsForm((f) => ({ ...f, announcementVisible: e.target.checked }))} disabled={settingsSaving} />
                  <span>Afficher l&apos;annonce sur la home / canal</span>
                </label>
                <label className="admin-settings-label">
                  Titre de l&apos;annonce
                  <input type="text" className="admin-settings-input" value={settingsForm.announcementTitle} onChange={(e) => setSettingsForm((f) => ({ ...f, announcementTitle: e.target.value }))} placeholder="Titre" disabled={settingsSaving} />
                </label>
                <label className="admin-settings-label">
                  Texte ou lien
                  <textarea className="admin-settings-input admin-settings-textarea" value={settingsForm.announcementBody} onChange={(e) => setSettingsForm((f) => ({ ...f, announcementBody: e.target.value }))} rows={2} disabled={settingsSaving} />
                </label>
                <label className="admin-settings-label">
                  Lien (optionnel)
                  <input type="url" className="admin-settings-input" value={settingsForm.announcementLink} onChange={(e) => setSettingsForm((f) => ({ ...f, announcementLink: e.target.value }))} placeholder="https://..." disabled={settingsSaving} />
                </label>
                <h3 className="admin-subsection-title">Pages d&apos;info (CGU, FAQ, À propos)</h3>
                <label className="admin-settings-label">CGU (texte court)</label>
                <textarea className="admin-settings-input admin-settings-textarea" value={settingsForm.pageCgu} onChange={(e) => setSettingsForm((f) => ({ ...f, pageCgu: e.target.value }))} rows={4} placeholder="Conditions générales..." disabled={settingsSaving} />
                <label className="admin-settings-label">FAQ</label>
                <textarea className="admin-settings-input admin-settings-textarea" value={settingsForm.pageFaq} onChange={(e) => setSettingsForm((f) => ({ ...f, pageFaq: e.target.value }))} rows={4} placeholder="Foire aux questions..." disabled={settingsSaving} />
                <label className="admin-settings-label">À propos</label>
                <textarea className="admin-settings-input admin-settings-textarea" value={settingsForm.pageAbout} onChange={(e) => setSettingsForm((f) => ({ ...f, pageAbout: e.target.value }))} rows={4} placeholder="À propos du site..." disabled={settingsSaving} />
                <button
                  type="submit"
                  className="admin-btn admin-btn-save"
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </form>
            )}
          </section>
        )}
      </main>

      {editUser && (
        <div className="admin-modal-overlay" onClick={() => !editSaving && setEditUser(null)} role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="admin-edit-title" className="admin-section-title">Modifier l&apos;utilisateur</h2>
            <p className="admin-modal-email">{editUser.email}</p>
            {editError && <div className="admin-error">{editError}</div>}
            <form
              className="admin-settings-form"
              onSubmit={(e) => { e.preventDefault(); saveEditUser(); }}
            >
              <label className="admin-settings-label">
                Pseudo
                <input
                  type="text"
                  className="admin-settings-input"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="Pseudo"
                  disabled={editSaving}
                />
              </label>
              <label className="admin-settings-label admin-settings-check">
                <input
                  type="checkbox"
                  checked={editForm.isDisabled}
                  onChange={(e) => setEditForm((f) => ({ ...f, isDisabled: e.target.checked }))}
                  disabled={editSaving || currentUserIdsMatch(editUser.id, user)}
                />
                <span>Désactiver le compte (l&apos;utilisateur ne pourra plus se connecter)</span>
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn" onClick={() => setEditUser(null)} disabled={editSaving}>
                  Annuler
                </button>
                <button type="submit" className="admin-btn admin-btn-save" disabled={editSaving}>
                  {editSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editRoom && (
        <div className="admin-modal-overlay" onClick={() => !roomEditSaving && setEditRoom(null)} role="dialog" aria-modal="true" aria-labelledby="admin-edit-room-title">
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="admin-edit-room-title" className="admin-section-title">Modifier le salon</h2>
            <p className="admin-modal-email">Identifiant : {editRoom.roomId}</p>
            {roomEditError && <div className="admin-error">{roomEditError}</div>}
            <form
              className="admin-settings-form"
              onSubmit={(e) => { e.preventDefault(); saveEditRoom(); }}
            >
              <label className="admin-settings-label">
                Nom affiché
                <input
                  type="text"
                  className="admin-settings-input"
                  value={editRoomForm.name}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nom du salon"
                  disabled={roomEditSaving}
                />
              </label>
              <label className="admin-settings-label">
                Description (optionnel)
                <textarea
                  className="admin-settings-input admin-settings-textarea"
                  value={editRoomForm.description}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  rows={3}
                  disabled={roomEditSaving}
                />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn" onClick={() => setEditRoom(null)} disabled={roomEditSaving}>
                  Annuler
                </button>
                <button type="submit" className="admin-btn admin-btn-save" disabled={roomEditSaving}>
                  {roomEditSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
