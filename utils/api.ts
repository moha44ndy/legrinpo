'use client';

import { showToast } from '@/utils/toast';

/**
 * Appel fetch avec affichage toast en cas d'erreur (réseau ou API).
 * Retourne une Response réutilisable (le corps est préservé pour que l'appelant puisse faire .json()).
 */
export async function fetchWithErrorToast(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      const message = (data?.error as string) || res.statusText || 'Erreur réseau';
      if (res.status === 429) {
        showToast('Trop de tentatives. Réessayez dans quelques minutes.', 'warning');
      } else {
        showToast(message, 'error');
      }
      return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    return res;
  } catch (err: any) {
    showToast(err?.message || 'Erreur de connexion', 'error');
    throw err;
  }
}
