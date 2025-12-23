'use client';

import { Toast, ToastType } from '@/components/Toast';

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

export function subscribeToToasts(callback: (toasts: Toast[]) => void) {
  toastListeners.push(callback);
  callback(toasts);
  
  return () => {
    toastListeners = toastListeners.filter((listener) => listener !== callback);
  };
}

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

function createToast(
  type: ToastType,
  title: string,
  message: string,
  options: {
    duration?: number;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } = {}
): string {
  const id = 'toast_' + Date.now() + Math.random().toString(36).substr(2);
  
  const toast: Toast = {
    id,
    type,
    title,
    message,
    duration: options.duration,
    onConfirm: options.onConfirm,
    onCancel: options.onCancel,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
  };
  
  toasts.push(toast);
  notifyListeners();
  
  return id;
}

export function showToast(message: string, type: ToastType = 'success') {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    confirm: '🗑️',
  };
  
  const titles = {
    success: 'Succès',
    error: 'Erreur',
    warning: 'Attention',
    info: 'Information',
    confirm: 'Confirmation',
  };
  
  return createToast(type, `${icons[type]} ${titles[type]}`, message);
}

export function showConfirmToast(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  options: { confirmText?: string; cancelText?: string } = {}
) {
  return createToast('confirm', `🗑️ ${title}`, message, {
    onConfirm,
    onCancel,
    confirmText: options.confirmText || 'Supprimer',
    cancelText: options.cancelText || 'Annuler',
    duration: 0,
  });
}

export function closeToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  notifyListeners();
}

