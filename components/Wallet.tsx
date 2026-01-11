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
    <div className="wallet-container-compact" style={{ position: 'relative' }}>
      <div 
        className="wallet-header-compact"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
        title="Cliquez pour voir les détails"
      >
        <span className="wallet-icon-compact">💰</span>
        <span className="wallet-balance-compact">{balance.toFixed(2)} FCFA</span>
      </div>
      
      {isExpanded && wallet && (
        <div className="wallet-details">
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

