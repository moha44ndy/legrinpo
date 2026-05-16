import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';
import { blockUser, getBlockedUsers, unblockUser } from '@/lib/user-moderation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const blocked = await getBlockedUsers(user.id);
    return NextResponse.json({ success: true, blocked });
  } catch {
    return NextResponse.json({ success: true, blocked: [] });
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'block-user', { windowMs: 60 * 1000, max: 30 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const blockedUserId = typeof body.blockedUserId === 'string' ? body.blockedUserId.trim() : '';
  const blockedUsername =
    typeof body.blockedUsername === 'string' ? body.blockedUsername.trim() : 'Utilisateur';

  if (!blockedUserId) {
    return NextResponse.json({ error: 'Utilisateur à bloquer manquant.' }, { status: 400 });
  }

  if (blockedUserId === user.uid || blockedUserId === String(user.id)) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous bloquer vous-même.' }, { status: 400 });
  }

  try {
    await blockUser(user.id, blockedUserId, blockedUsername);
    const blocked = await getBlockedUsers(user.id);
    return NextResponse.json({ success: true, blocked });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors du blocage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const blockedUserId = request.nextUrl.searchParams.get('userId')?.trim() || '';
  if (!blockedUserId) {
    return NextResponse.json({ error: 'Utilisateur manquant.' }, { status: 400 });
  }

  try {
    await unblockUser(user.id, blockedUserId);
    const blocked = await getBlockedUsers(user.id);
    return NextResponse.json({ success: true, blocked });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors du déblocage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
