'use client';

import { useWallet } from '@/hooks/useWallet';
import { useState } from 'react';
import './Wallet.css';

interface WalletProps {
  userId: string;
  username?: string;
}

export default function Wallet({ userId, username }: WalletProps) {
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
        <div className="wallet-header">
          <span className="wallet-icon">💰</span>
          <span className="wallet-error">{error}</span>
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
        <span className="wallet-balance">{balance.toFixed(0)} pts</span>
        <span className="wallet-toggle">{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && wallet && (
        <div className="wallet-details">
          <div className="wallet-stat">
            <span className="wallet-stat-label">Total gagné:</span>
            <span className="wallet-stat-value">{wallet.totalEarned.toFixed(0)} pts</span>
          </div>
          <div className="wallet-stat">
            <span className="wallet-stat-label">Total dépensé:</span>
            <span className="wallet-stat-value">{wallet.totalSpent.toFixed(0)} pts</span>
          </div>
          <div className="wallet-info">
            <p>💬 Commentaire envoyé: <strong>+5 pts</strong></p>
            <p>👍 Réaction reçue: <strong>+2 pts</strong></p>
            <p>⭐ Commentaire liké: <strong>+3 pts</strong></p>
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

