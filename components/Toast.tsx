'use client';

import { useEffect, useState } from 'react';
import { IconCheck, IconError, IconWarning, IconInfo, IconTrash } from '@/components/Icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="toast-container" id="toastContainer">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const isConfirm = toast.type === 'confirm';
  const duration = toast.duration || (isConfirm ? 0 : (toast.type === 'error' ? 6000 : 4000));

  useEffect(() => {
    setIsVisible(true);
    
    if (duration > 0 && !isConfirm) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(toast.id), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isConfirm, toast.id, onClose]);

  const handleConfirm = () => {
    toast.onConfirm?.();
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  const handleCancel = () => {
    toast.onCancel?.();
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      className={`toast ${toast.type} ${isVisible ? 'show' : ''} ${isConfirm ? 'confirm' : ''}`}
      onClick={!isConfirm ? () => {
        setIsVisible(false);
        setTimeout(() => onClose(toast.id), 300);
      } : undefined}
    >
      <div className="toast-header">
        <span className="toast-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'success' && <IconCheck size={18} className="toast-type-icon" />}
          {toast.type === 'error' && <IconError size={18} className="toast-type-icon" />}
          {toast.type === 'warning' && <IconWarning size={18} className="toast-type-icon" />}
          {toast.type === 'info' && <IconInfo size={18} className="toast-type-icon" />}
          {toast.type === 'confirm' && <IconTrash size={18} className="toast-type-icon" />}
          <span>{toast.title}</span>
        </span>
        {!isConfirm && (
          <button className="toast-close" onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose(toast.id), 300);
          }}>
            &times;
          </button>
        )}
      </div>
      <div className="toast-message" dangerouslySetInnerHTML={{ __html: toast.message }} />
      
      {isConfirm && (toast.onConfirm || toast.onCancel) && (
        <div className="toast-actions">
          {toast.onConfirm && (
            <button className="toast-btn toast-btn-confirm" onClick={handleConfirm}>
              {toast.confirmText || 'Confirmer'}
            </button>
          )}
          {toast.onCancel && (
            <button className="toast-btn toast-btn-cancel" onClick={handleCancel}>
              {toast.cancelText || 'Annuler'}
            </button>
          )}
        </div>
      )}
      
      {duration > 0 && !isConfirm && (
        <div className="toast-progress">
          <div
            className="toast-progress-bar"
            style={{
              width: isVisible ? '100%' : '0%',
              transition: `width ${duration}ms linear`,
            }}
          />
        </div>
      )}
    </div>
  );
}

