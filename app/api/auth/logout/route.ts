import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');

    return NextResponse.json({
      success: true,
      message: 'Déconnexion réussie',
    });
  } catch (error: any) {
    console.error('Erreur lors de la déconnexion:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion', details: error.message },
      { status: 500 }
    );
  }
}

