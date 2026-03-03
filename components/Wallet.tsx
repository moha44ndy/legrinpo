'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { IconWallet, IconRefresh, IconWithdraw, IconCheck, IconPlus, IconEdit, IconTrash } from '@/components/Icons';
import './Wallet.css';

interface WalletProps {
  userId: string;
  username?: string;
  userEmail?: string;
}

type WithdrawMethod = 'wave' | 'orange_money' | 'moov_money' | 'mtn_money' | 'carte_bancaire';

const WITHDRAW_METHODS: { value: WithdrawMethod; label: string }[] = [
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'moov_money', label: 'Moov Money' },
  { value: 'mtn_money', label: 'MTN Money' },
  { value: 'carte_bancaire', label: 'Compte bancaire' },
];

const WITHDRAW_COUNTRIES = [
  'Côte d\'Ivoire',
  'Sénégal',
  'Bénin',
  'Burkina Faso',
  'Mali',
  'Niger',
  'Togo',
  'Guinée-Bissau',
  'Cameroun',
  'Gabon',
  'Congo-Brazzaville',
  'Tchad',
  'Centrafrique',
  'Guinée équatoriale',
];

const MIN_WITHDRAWAL = 5000;

export default function Wallet({ userId, username, userEmail }: WalletProps) {
  // Ne pas afficher si userId n'est pas disponible
  if (!userId) {
    console.warn('Wallet: userId non disponible');
    return null;
  }

  const { wallet, balance, loading, error, refreshBalance } = useWallet(userId);
  const { userProfile, updateUserProfile, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawSent, setWithdrawSent] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    method: 'wave' as WithdrawMethod,
    country: '',
    phoneOrIban: '',
    fullName: '',
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [helpForm, setHelpForm] = useState({ subject: '', message: '' });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editUsernameValue, setEditUsernameValue] = useState('');
  const [usernameEditError, setUsernameEditError] = useState<string | null>(null);
  const [usernameEditSaving, setUsernameEditSaving] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  const isBankCard = withdrawForm.method === 'carte_bancaire';

  // Réinitialiser l'erreur d'affichage de l'avatar quand l'URL change (nouvel upload)
  useEffect(() => {
    setAvatarImgFailed(false);
  }, [userProfile?.avatar]);

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="wallet-header">
          <IconWallet size={18} className="wallet-icon" />
          <span className="wallet-loading">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-container">
        <div className="wallet-header" title={error}>
          <IconWallet size={18} className="wallet-icon" />
          <span className="wallet-error" style={{ fontSize: '12px', color: '#ff6b6b' }}>
            Erreur
          </span>
        </div>
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.'
    );
    if (!confirmed) return;
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erreur lors de la suppression du compte.');
        return;
      }
      await logout();
      router.push('/login');
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la suppression du compte.');
    }
  };

  return (
    <>
      <div className={`wallet-container-compact${isExpanded ? ' wallet-container-expanded' : ''}`}>
        <div 
          className="wallet-header-compact"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Cliquez pour voir les détails"
        >
          <IconWallet size={14} className="wallet-icon-compact" />
          {username && <span className="wallet-username-compact">{username.toUpperCase()}</span>}
          <span className="wallet-balance-compact">{balance.toFixed(2)} FCFA</span>
        </div>
        
        {isExpanded && wallet && (
          <div className="wallet-details">
          {(username || userProfile?.username) && (
            <p className="wallet-details-username">
              <span className="wallet-avatar-wrap">
                {userProfile?.avatar && !avatarImgFailed ? (
                  <button
                    type="button"
                    className="wallet-avatar-preview-trigger"
                    onClick={() => setShowAvatarPreview(true)}
                    title="Voir en grand"
                  >
                    <img
                      key={userProfile.avatar}
                      src={userProfile.avatar}
                      alt=""
                      className="wallet-avatar-details wallet-avatar-img"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarImgFailed(true)}
                    />
                  </button>
                ) : (
                  <span className="wallet-avatar-details">{(userProfile?.username || username || '').charAt(0).toUpperCase() || '?'}</span>
                )}
                <label className="wallet-avatar-plus-wrap" title="Changer la photo de profil">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    className="wallet-avatar-input"
                    disabled={avatarUploading}
                    aria-label="Changer la photo de profil"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !userId) return;
                      setAvatarError(null);
                      setAvatarUploading(true);
                      const timeoutMs = 20000;
                      const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('Délai dépassé. Vérifiez votre connexion.')), timeoutMs);
                      });
                      try {
                        const formData = new FormData();
                        formData.append('avatar', file);
                        const res = await Promise.race([
                          fetch('/api/profile/avatar', { method: 'POST', body: formData }),
                          timeoutPromise,
                        ]);
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setAvatarError(data.error || 'Erreur lors de l\'upload.');
                          return;
                        }
                        if (data.avatar) {
                          await updateUserProfile({ avatar: data.avatar });
                        } else if (data.user?.avatar) {
                          await updateUserProfile({ avatar: data.user.avatar });
                        }
                      } catch (err: any) {
                        setAvatarError(err?.message || 'Erreur lors de l\'upload.');
                      } finally {
                        setAvatarUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <span className="wallet-avatar-plus" aria-hidden="true"><IconPlus size={10} /></span>
                </label>
                {avatarUploading && (
                  <span className="wallet-avatar-loading" aria-hidden="true">
                    <span className="wallet-avatar-spinner" />
                  </span>
                )}
              </span>
              {editingUsername ? (
                <span className="wallet-username-edit-wrap">
                  <input
                    type="text"
                    className="wallet-username-edit-input"
                    value={editUsernameValue}
                    onChange={(e) => {
                      setEditUsernameValue(e.target.value);
                      setUsernameEditError(null);
                    }}
                    placeholder="Nouveau pseudo (min. 3 caractères)"
                    disabled={usernameEditSaving}
                    autoFocus
                    maxLength={50}
                    aria-label="Nouveau nom d’utilisateur"
                  />
                  <button
                    type="button"
                    className="wallet-username-edit-btn wallet-username-edit-save"
                    onClick={async () => {
                      const val = editUsernameValue.trim();
                      if (val.length < 3) {
                        setUsernameEditError('Au moins 3 caractères.');
                        return;
                      }
                      setUsernameEditError(null);
                      setUsernameEditSaving(true);
                      try {
                        await updateUserProfile({ username: val });
                        setEditingUsername(false);
                        setEditUsernameValue('');
                      } catch (err: any) {
                        setUsernameEditError(err?.message || 'Erreur.');
                      } finally {
                        setUsernameEditSaving(false);
                      }
                    }}
                    disabled={usernameEditSaving}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className="wallet-username-edit-btn wallet-username-edit-cancel"
                    onClick={() => {
                      setEditingUsername(false);
                      setEditUsernameValue('');
                      setUsernameEditError(null);
                    }}
                    disabled={usernameEditSaving}
                  >
                    Annuler
                  </button>
                </span>
              ) : (
                <>
                  <span className="wallet-details-username-text">
                    {(userProfile?.username || username || '').toUpperCase()}
                  </span>
                  {(userProfile as { isAdmin?: boolean })?.isAdmin === true && (
                    <span className="wallet-admin-badge" title="Compte administrateur">Admin</span>
                  )}
                  <button
                    type="button"
                    className="wallet-username-edit-pencil"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditUsernameValue(userProfile?.username || username || '');
                      setUsernameEditError(null);
                      setEditingUsername(true);
                    }}
                    title="Modifier le pseudo"
                    aria-label="Modifier le pseudo"
                  >
                    <IconEdit size={14} />
                  </button>
                </>
              )}
            </p>
          )}
          {usernameEditError && <p className="wallet-avatar-error">{usernameEditError}</p>}
          {avatarError && <p className="wallet-avatar-error">{avatarError}</p>}
          <button 
            className={`wallet-refresh-btn${isRefreshing ? ' wallet-refreshing' : ''}`}
            onClick={async (e) => {
              e.stopPropagation();
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                await refreshBalance();
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
          >
            <IconRefresh size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Actualiser
          </button>
          <button 
            className="wallet-withdraw-btn"
            onClick={(e) => {
              e.stopPropagation();
              setWithdrawSent(false);
              setWithdrawError(null);
              requestAnimationFrame(() => setShowWithdrawModal(true));
            }}
          >
            <IconWithdraw size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Retirer mon argent
          </button>
          <button
            type="button"
            className="wallet-settings-btn"
            onClick={(e) => {
              e.stopPropagation();
              requestAnimationFrame(() => setShowSettingsModal(true));
            }}
          >
            Paramètres
          </button>
          <Link
            href="/help"
            className="wallet-help-btn"
            onClick={(e) => e.stopPropagation()}
          >
            Aide
          </Link>
          {(userProfile as { isAdmin?: boolean })?.isAdmin === true && (
            <Link
              href="/admin"
              className="wallet-admin-btn"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            >
              Dashboard admin
            </Link>
          )}
          <button 
            type="button"
            className="wallet-logout-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
              setIsExpanded(false);
              // Déconnecter en différé pour améliorer l'INP (paint du panneau fermé d'abord)
              setTimeout(() => {
                logout().then(() => router.push('/login'));
              }, 0);
            }}
          >
            Déconnexion
          </button>
          {balance > 0 && balance < MIN_WITHDRAWAL && (
            <p className="wallet-withdraw-hint">Retrait à partir de {MIN_WITHDRAWAL.toLocaleString()} FCFA</p>
          )}
        </div>
      )}
      </div>

      {isExpanded && (
        <div
          className="wallet-dropdown-backdrop"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {showWithdrawModal && (
        <div 
          className="withdraw-modal-overlay" 
          onClick={() => !withdrawSubmitting && setShowWithdrawModal(false)}
        >
          <div className="withdraw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="withdraw-modal-header">
              <div className="withdraw-modal-header-inner">
                <IconWithdraw size={28} className="withdraw-modal-icon" />
                <h3 className="withdraw-modal-title">Demande de retrait</h3>
              </div>
              <button
                type="button"
                className="withdraw-modal-close"
                onClick={() => !withdrawSubmitting && setShowWithdrawModal(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            {withdrawSent ? (
              <div className="withdraw-success">
                <div className="withdraw-success-icon"><IconCheck size={28} /></div>
                <h4 className="withdraw-success-title">Demande envoyée</h4>
                <p className="withdraw-success-text">Nous avons bien pris votre demande en compte.</p>
                <p className="withdraw-success-note">Après validation sous 24 h, l&apos;argent vous sera envoyé.</p>
                <button 
                  type="button" 
                  className="withdraw-success-btn"
                  onClick={() => { setShowWithdrawModal(false); setWithdrawSent(false); }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form
                className="withdraw-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setWithdrawError(null);
                  const amount = parseFloat(withdrawForm.amount.replace(/,/, '.'));
                  if (!withdrawForm.amount || isNaN(amount) || amount <= 0) {
                    setWithdrawError('Montant invalide.');
                    return;
                  }
                  if (amount < MIN_WITHDRAWAL) {
                    setWithdrawError(`Le retrait minimum est de ${MIN_WITHDRAWAL.toLocaleString()} FCFA.`);
                    return;
                  }
                  if (amount > balance) {
                    setWithdrawError('Le montant ne peut pas dépasser votre solde.');
                    return;
                  }
                  if (!withdrawForm.phoneOrIban.trim()) {
                    setWithdrawError(isBankCard ? 'IBAN / numéro de compte requis.' : 'Numéro de téléphone requis.');
                    return;
                  }
                  if (!withdrawForm.fullName.trim()) {
                    setWithdrawError('Nom complet requis.');
                    return;
                  }
                  if (!userEmail?.trim()) {
                    setWithdrawError('Email du compte indisponible. Réessayez plus tard.');
                    return;
                  }
                  setWithdrawSubmitting(true);
                  try {
                    const res = await fetch('/api/wallet/withdraw', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId,
                        username: username || '',
                        userEmail: userEmail.trim(),
                        amount,
                        method: withdrawForm.method,
                        country: withdrawForm.country.trim(),
                        phoneOrIban: withdrawForm.phoneOrIban.trim(),
                        fullName: withdrawForm.fullName.trim(),
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setWithdrawError(data.error || 'Erreur lors de l\'envoi.');
                      return;
                    }
                    setWithdrawSent(true);
                  } catch (err) {
                    setWithdrawError('Erreur de connexion. Réessayez.');
                  } finally {
                    setWithdrawSubmitting(false);
                  }
                }}
              >
                <div className="withdraw-form-balance">
                  <span className="withdraw-form-balance-label">Votre solde</span>
                  <span className="withdraw-form-balance-value">{balance.toLocaleString()} FCFA</span>
                  <span className="withdraw-form-balance-min">Minimum : {MIN_WITHDRAWAL.toLocaleString()} FCFA</span>
                </div>
                <label className="withdraw-form-label">
                  Montant (FCFA)
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Min. ${MIN_WITHDRAWAL.toLocaleString()}`}
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <label className="withdraw-form-label">
                  Mode de retrait
                  <select
                    value={withdrawForm.method}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, method: e.target.value as WithdrawMethod }))}
                  >
                    {WITHDRAW_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="withdraw-form-label">
                  Pays
                  <select
                    value={withdrawForm.country}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, country: e.target.value }))}
                    aria-label="Choisir votre pays"
                  >
                    <option value="">Choisir un pays</option>
                    {WITHDRAW_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="withdraw-form-label">
                  {isBankCard ? 'IBAN / Numéro de compte' : 'Numéro de téléphone'}
                  <input
                    type="text"
                    placeholder={isBankCard ? 'Ex: SN08...' : 'Ex: 7X XX XX XX XX'}
                    value={withdrawForm.phoneOrIban}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, phoneOrIban: e.target.value }))}
                  />
                </label>
                <label className="withdraw-form-label">
                  Nom complet
                  <input
                    type="text"
                    placeholder="Nom et prénom"
                    value={withdrawForm.fullName}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </label>
                {withdrawError && <div className="withdraw-form-error">{withdrawError}</div>}
                <div className="withdraw-form-actions">
                  <button type="button" className="withdraw-form-cancel" onClick={() => setShowWithdrawModal(false)} disabled={withdrawSubmitting}>
                    Annuler
                  </button>
                  <button type="submit" className="withdraw-form-submit" disabled={withdrawSubmitting}>
                    {withdrawSubmitting ? 'Envoi en cours…' : 'Envoyer la demande'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div
          className="withdraw-modal-overlay"
          onClick={() => setShowSettingsModal(false)}
        >
          <div className="withdraw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="withdraw-modal-header">
              <div className="withdraw-modal-header-inner">
                <span className="withdraw-modal-icon settings-modal-icon" aria-hidden="true">⚙</span>
                <h3 className="withdraw-modal-title">Paramètres</h3>
              </div>
              <button
                type="button"
                className="withdraw-modal-close"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="wallet-settings-content">
              <Link
                href="/change-password"
                className="wallet-settings-link"
                onClick={() => { setShowSettingsModal(false); setIsExpanded(false); }}
              >
                Changer mon mot de passe
              </Link>
              <button
                type="button"
                className="wallet-settings-link wallet-settings-link-danger"
                onClick={handleDeleteAccount}
              >
                Supprimer mon compte
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div
          className="withdraw-modal-overlay"
          onClick={() => !helpSubmitting && setShowHelpModal(false)}
        >
          <div className="withdraw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="withdraw-modal-header">
              <div className="withdraw-modal-header-inner">
                <span className="withdraw-modal-icon help-modal-icon" aria-hidden="true">?</span>
                <h3 className="withdraw-modal-title">Aide</h3>
              </div>
              <button
                type="button"
                className="withdraw-modal-close"
                onClick={() => !helpSubmitting && setShowHelpModal(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            {helpSent ? (
              <div className="withdraw-success">
                <div className="withdraw-success-icon"><IconCheck size={28} /></div>
                <h4 className="withdraw-success-title">Message envoyé</h4>
                <p className="withdraw-success-text">Nous avons bien reçu votre demande. Notre équipe vous répondra dans les plus brefs délais.</p>
                <button
                  type="button"
                  className="withdraw-success-btn"
                  onClick={() => { setShowHelpModal(false); setHelpSent(false); }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form
                className="withdraw-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setHelpError(null);
                  if (!helpForm.subject.trim()) {
                    setHelpError('Veuillez choisir un sujet.');
                    return;
                  }
                  if (!helpForm.message.trim()) {
                    setHelpError('Veuillez décrire votre demande.');
                    return;
                  }
                  setHelpSubmitting(true);
                  try {
                    const res = await fetch('/api/help', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId,
                        username: username || '',
                        userEmail: userEmail || '',
                        subject: helpForm.subject.trim(),
                        message: helpForm.message.trim(),
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setHelpError(data.error || 'Erreur lors de l\'envoi.');
                      return;
                    }
                    setHelpSent(true);
                  } catch {
                    setHelpError('Erreur de connexion. Réessayez.');
                  } finally {
                    setHelpSubmitting(false);
                  }
                }}
              >
                <label className="withdraw-form-label">
                  Sujet
                  <select
                    value={helpForm.subject}
                    onChange={(e) => setHelpForm((f) => ({ ...f, subject: e.target.value }))}
                  >
                    <option value="">Choisir un sujet</option>
                    <option value="portefeuille">Question sur le portefeuille</option>
                    <option value="retrait">Problème de retrait</option>
                    <option value="technique">Problème technique</option>
                    <option value="autre">Autre</option>
                  </select>
                </label>
                <label className="withdraw-form-label">
                  Votre message
                  <textarea
                    rows={4}
                    placeholder="Décrivez votre question ou problème..."
                    value={helpForm.message}
                    onChange={(e) => setHelpForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </label>
                {helpError && <div className="withdraw-form-error">{helpError}</div>}
                <div className="withdraw-form-actions">
                  <button type="button" className="withdraw-form-cancel" onClick={() => setShowHelpModal(false)} disabled={helpSubmitting}>
                    Annuler
                  </button>
                  <button type="submit" className="withdraw-form-submit" disabled={helpSubmitting}>
                    {helpSubmitting ? 'Envoi en cours…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showAvatarPreview && userProfile?.avatar && (
        <div
          className="wallet-avatar-preview-overlay"
          onClick={() => setShowAvatarPreview(false)}
          aria-label="Fermer l’aperçu"
        >
          <button
            type="button"
            className="wallet-avatar-preview-close"
            onClick={() => setShowAvatarPreview(false)}
            aria-label="Fermer"
          >
            ×
          </button>
          <img
            src={userProfile.avatar}
            alt="Photo de profil"
            className="wallet-avatar-preview-img"
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
            onError={() => setAvatarImgFailed(true)}
          />
          <button
            type="button"
            className="wallet-avatar-preview-delete"
            onClick={async (e) => {
              e.stopPropagation();
              if (avatarDeleting) return;
              setAvatarError(null);
              setAvatarDeleting(true);
              try {
                const res = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ avatar: '' }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setAvatarError(data.error || 'Impossible de supprimer la photo.');
                  return;
                }
                await updateUserProfile({ avatar: undefined });
                setShowAvatarPreview(false);
              } catch (err: any) {
                setAvatarError(err?.message || 'Impossible de supprimer la photo.');
              } finally {
                setAvatarDeleting(false);
              }
            }}
            disabled={avatarDeleting}
            aria-label="Supprimer la photo de profil"
            title="Supprimer la photo de profil"
          >
            <IconTrash size={20} />
          </button>
        </div>
      )}
    </>
  );
}

