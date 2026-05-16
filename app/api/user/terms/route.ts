import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { acceptTerms, getTermsAccepted } from '@/lib/user-moderation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const accepted = await getTermsAccepted(user.id);
    return NextResponse.json({ success: true, accepted });
  } catch {
    return NextResponse.json({ success: true, accepted: false });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.accepted) {
    return NextResponse.json({ error: 'Vous devez accepter les conditions.' }, { status: 400 });
  }

  try {
    await acceptTerms(user.id);
    return NextResponse.json({ success: true, accepted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
