import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Cron Vercel: ping quotidien pour éviter l'inactivité Supabase.
 * Route: GET /api/cron/supabase-keepalive
 */
export async function GET(request: NextRequest) {
  try {
    // Sécurité optionnelle: si CRON_SECRET est défini, on exige le secret.
    // Compatible avec Vercel Cron (Authorization: Bearer <CRON_SECRET>)
    // et les appels manuels (x-cron-secret).
    const expectedSecret = process.env.CRON_SECRET;
    const incomingSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (
      expectedSecret &&
      incomingSecret !== expectedSecret &&
      bearerToken !== expectedSecret
    ) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Supabase Admin non configuré' },
        { status: 500 }
      );
    }

    // Requête légère et stable: lecture d'un seul user auth.
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase keep-alive OK',
      usersFetched: data.users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur keep-alive Supabase',
        details: error?.message ?? 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
