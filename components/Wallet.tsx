'use client';

import { useWallet } from '@/hooks/useWallet';
import { useState } from 'react';
import './Wallet.css';

interface WalletProps {
  userId: string;
  username?: string;
}

export default function Wallet({ userId, username }: WalletProps) {
  // Ne pas afficher si userId n'est pas disponible
  if (!userId) {
    console.warn('Wallet: userId non disponible');
    return null;
  }

  const { wallet, balance, loading, error, refreshBalance } = useWallet(userId);
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="wallet-header">
          <span className="wallet-icon">💰</span>
          <span className="wallet-loading">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-container">
        <div className="wallet-header" title={error}>
          <span className="wallet-icon">💰</span>
          <span className="wallet-error" style={{ fontSize: '12px', color: '#ff6b6b' }}>
            Erreur
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <div 
        className="wallet-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <span className="wallet-icon">💰</span>
        <span className="wallet-balance">{balance.toFixed(3)} FCFA</span>
        <span className="wallet-toggle">{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && wallet && (
        <div className="wallet-details">
          <div className="wallet-stat">
            <span className="wallet-stat-label">Total gagné:</span>
            <span className="wallet-stat-value">{wallet.totalEarned.toFixed(3)} FCFA</span>
          </div>
          <div className="wallet-stat">
            <span className="wallet-stat-label">Total dépensé:</span>
            <span className="wallet-stat-value">{wallet.totalSpent.toFixed(3)} FCFA</span>
          </div>
          <div className="wallet-info">
            <p>❤️ Réaction reçue: <strong>+0.01 FCFA</strong></p>
            <p>🔥 Réaction reçue: <strong>+0.02 FCFA</strong></p>
            <p>😡 Réaction reçue: <strong>-0.005 FCFA</strong></p>
            <p>👥 Bonus mensuel créateur: <strong>+0.01 FCFA × membres</strong></p>
          </div>
          <button 
            className="wallet-refresh-btn"
            onClick={(e) => {
              e.stopPropagation();
              refreshBalance();
            }}
          >
            🔄 Actualiser
          </button>
        </div>
      )}
    </div>
  );
}

