import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isCurrentUserAdmin, getCurrentAdminUser } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-logger';

const DEFAULTS: Record<string, string | boolean> = {
  siteName: 'Legrinpo',
  maintenanceMode: false,
  maintenanceMessage: 'Le site est actuellement en maintenance. Réessayez plus tard.',
  announcementTitle: '',
  announcementBody: '',
  announcementLink: '',
  announcementVisible: false,
  pageCgu: '',
  pageFaq: '',
  pageAbout: '',
  adCanalDiscussion: '',
  adCanalNative: '',
};

function toBool(v: unknown): boolean {
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  return false;
}

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const rows = await query('SELECT k, v FROM settings');
    const map: Record<string, string> = {};
    if (Array.isArray(rows)) {
      rows.forEach((r: any) => {
        map[r.k ?? r.key] = r.v ?? r.value ?? '';
      });
    }
    const settings = {
      siteName: (map.siteName ?? map.site_name ?? DEFAULTS.siteName).trim() || String(DEFAULTS.siteName),
      maintenanceMode: toBool(map.maintenanceMode ?? map.maintenance_mode ?? DEFAULTS.maintenanceMode),
      maintenanceMessage: (map.maintenanceMessage ?? map.maintenance_message ?? DEFAULTS.maintenanceMessage).trim() || String(DEFAULTS.maintenanceMessage),
      announcementTitle: (map.announcementTitle ?? map.announcement_title ?? '').trim(),
      announcementBody: (map.announcementBody ?? map.announcement_body ?? '').trim(),
      announcementLink: (map.announcementLink ?? map.announcement_link ?? '').trim(),
      announcementVisible: toBool(map.announcementVisible ?? map.announcement_visible ?? false),
      pageCgu: (map.pageCgu ?? map.page_cgu ?? '').trim(),
      pageFaq: (map.pageFaq ?? map.page_faq ?? '').trim(),
      pageAbout: (map.pageAbout ?? map.page_about ?? '').trim(),
      adCanalDiscussion: (map.adCanalDiscussion ?? map.ad_canal_discussion ?? '').trim(),
      adCanalNative: (map.adCanalNative ?? map.ad_canal_native ?? '').trim(),
    };
    return NextResponse.json({ success: true, settings });
  } catch (e: any) {
    if (e?.message?.includes('exist') || e?.code === '42P01' || e?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, settings: DEFAULTS });
    }
    console.error('Erreur admin settings GET:', e);
    return NextResponse.json(
      { error: 'Erreur chargement paramètres', details: e?.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const body = await request.json();
    const updates: Array<{ k: string; v: string }> = [];
    if (body.siteName !== undefined) {
      updates.push({ k: 'siteName', v: String(body.siteName).trim() || String(DEFAULTS.siteName) });
    }
    if (body.maintenanceMode !== undefined) {
      updates.push({ k: 'maintenanceMode', v: toBool(body.maintenanceMode) ? '1' : '0' });
    }
    if (body.maintenanceMessage !== undefined) {
      updates.push({ k: 'maintenanceMessage', v: String(body.maintenanceMessage).trim().slice(0, 2000) });
    }
    if (body.announcementTitle !== undefined) updates.push({ k: 'announcementTitle', v: String(body.announcementTitle).trim().slice(0, 500) });
    if (body.announcementBody !== undefined) updates.push({ k: 'announcementBody', v: String(body.announcementBody).trim().slice(0, 2000) });
    if (body.announcementLink !== undefined) updates.push({ k: 'announcementLink', v: String(body.announcementLink).trim().slice(0, 500) });
    if (body.announcementVisible !== undefined) updates.push({ k: 'announcementVisible', v: toBool(body.announcementVisible) ? '1' : '0' });
    if (body.pageCgu !== undefined) updates.push({ k: 'pageCgu', v: String(body.pageCgu).trim().slice(0, 10000) });
    if (body.pageFaq !== undefined) updates.push({ k: 'pageFaq', v: String(body.pageFaq).trim().slice(0, 10000) });
    if (body.pageAbout !== undefined) updates.push({ k: 'pageAbout', v: String(body.pageAbout).trim().slice(0, 10000) });
    if (body.adCanalDiscussion !== undefined) updates.push({ k: 'adCanalDiscussion', v: String(body.adCanalDiscussion).trim().slice(0, 15000) });
    if (body.adCanalNative !== undefined) updates.push({ k: 'adCanalNative', v: String(body.adCanalNative).trim().slice(0, 15000) });
    if (updates.length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }
    const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    for (const { k, v } of updates) {
      if (useSupabase) {
        const existing = await query('SELECT 1 FROM settings WHERE k = ?', [k]).catch(() => []);
        const rows = Array.isArray(existing) ? existing : [];
        if (rows.length > 0) {
          await query('UPDATE settings SET v = ? WHERE k = ?', [v, k]);
        } else {
          await query('INSERT INTO settings (k, v) VALUES (?, ?)', [k, v]);
        }
      } else {
        await query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [k, v]);
      }
    }
    const admin = await getCurrentAdminUser();
    if (admin) logAdminAction({ adminUserId: admin.id, adminEmail: admin.email, action: 'settings_updated', targetType: 'settings', details: Object.keys(body).join(', ') });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message?.includes('exist') || e?.code === '42P01' || e?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { error: 'Table settings manquante. Exécutez le script database/settings_table.sql dans votre base.' },
        { status: 400 }
      );
    }
    console.error('Erreur admin settings PATCH:', e);
    return NextResponse.json(
      { error: 'Erreur enregistrement paramètres', details: e?.message },
      { status: 500 }
    );
  }
}
