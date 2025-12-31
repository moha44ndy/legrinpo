import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { rewardMonthlyBonus } from '@/utils/wallet';

/**
 * Vérifie si le bonus a déjà été distribué ce mois-ci pour un groupe
 */
async function hasBonusBeenDistributedThisMonth(roomId: string): Promise<boolean> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const bonusRef = doc(db, 'monthly_bonus', `${roomId}_${yearMonth}`);
  const bonusDoc = await getDoc(bonusRef);
  
  return bonusDoc.exists();
}

/**
 * Marque le bonus comme distribué pour ce mois
 */
async function markBonusAsDistributed(roomId: string, creatorId: string, memberCount: number, bonusAmount: number): Promise<void> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const bonusRef = doc(db, 'monthly_bonus', `${roomId}_${yearMonth}`);
  await setDoc(bonusRef, {
    roomId,
    creatorId,
    memberCount,
    bonusAmount,
    distributedAt: serverTimestamp(),
    yearMonth,
  });
}

/**
 * Trouve tous les groupes et leurs créateurs
 * Utilise une collection de métadonnées pour stocker les informations des groupes
 */
async function getAllGroupsWithCreators(): Promise<Array<{ roomId: string; creatorId: string }>> {
  const groups: Array<{ roomId: string; creatorId: string }> = [];
  
  try {
    // Essayer d'abord de récupérer depuis la collection de métadonnées
    const roomsMetadataRef = collection(db, 'rooms_metadata');
    const roomsSnapshot = await getDocs(roomsMetadataRef);
    
    roomsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.roomId && data.createdBy && !data.roomId.startsWith('public_')) {
        groups.push({
          roomId: data.roomId,
          creatorId: data.createdBy,
        });
      }
    });
    
    // Si aucun groupe trouvé dans les métadonnées, essayer de les trouver dans les settings
    if (groups.length === 0) {
      // Note: Cette méthode nécessite de connaître les roomIds à l'avance
      // Pour une solution complète, il faudrait créer une collection rooms_metadata
      // lors de la création de chaque groupe
      console.warn('Aucun groupe trouvé dans rooms_metadata. Assurez-vous que les groupes sont enregistrés lors de leur création.');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des groupes:', error);
  }
  
  return groups;
}

/**
 * API Route pour distribuer le bonus mensuel aux créateurs de groupes
 * 
 * POST /api/wallet/monthly-bonus
 * Body (optionnel): { roomId: string, creatorId: string } - Si fourni, distribue pour un seul groupe
 *                    Si non fourni, distribue pour tous les groupes automatiquement
 * 
 * Pour automatisation (cron job):
 * POST /api/wallet/monthly-bonus avec header: X-Cron-Secret (optionnel, pour sécurité)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { roomId, creatorId, auto } = body;
    
    // Si auto=true ou si aucun roomId/creatorId n'est fourni, distribuer pour tous les groupes
    if (auto === true || (!roomId && !creatorId)) {
      return await distributeBonusToAllGroups();
    }
    
    // Sinon, distribuer pour un seul groupe
    if (!roomId || !creatorId) {
      return NextResponse.json(
        { error: 'roomId et creatorId sont requis, ou utilisez auto=true pour distribuer à tous' },
        { status: 400 }
      );
    }

    // Vérifier si le bonus a déjà été distribué ce mois-ci
    if (await hasBonusBeenDistributedThisMonth(roomId)) {
      return NextResponse.json({
        success: false,
        message: 'Le bonus mensuel a déjà été distribué ce mois-ci pour ce groupe',
        roomId,
      });
    }

    // Compter le nombre de membres uniques dans le groupe
    const messagesRef = collection(db, 'chats', roomId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const uniqueUserIds = new Set<string>();
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        uniqueUserIds.add(data.userId);
      }
    });

    const memberCount = uniqueUserIds.size;

    if (memberCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucun membre dans ce groupe',
        roomId,
        memberCount: 0,
      });
    }

    // Distribuer le bonus mensuel
    const bonusAmount = memberCount * 0.01;
    await rewardMonthlyBonus(roomId, creatorId, memberCount);
    
    // Marquer comme distribué
    await markBonusAsDistributed(roomId, creatorId, memberCount, bonusAmount);

    return NextResponse.json({
      success: true,
      message: `Bonus mensuel distribué: ${bonusAmount.toFixed(3)} FCFA pour ${memberCount} membre(s)`,
      roomId,
      creatorId,
      memberCount,
      bonusAmount,
    });
  } catch (error: any) {
    console.error('Erreur lors de la distribution du bonus mensuel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la distribution du bonus mensuel', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Distribue le bonus mensuel à tous les groupes automatiquement
 */
async function distributeBonusToAllGroups() {
  const results = {
    total: 0,
    distributed: 0,
    skipped: 0,
    errors: 0,
    details: [] as Array<{
      roomId: string;
      creatorId: string;
      status: 'distributed' | 'skipped' | 'error';
      memberCount?: number;
      bonusAmount?: number;
      message?: string;
    }>,
  };

  try {
    // Récupérer tous les groupes avec leurs créateurs
    const groups = await getAllGroupsWithCreators();
    results.total = groups.length;

    // Distribuer le bonus pour chaque groupe
    for (const group of groups) {
      try {
        // Vérifier si le bonus a déjà été distribué ce mois-ci
        if (await hasBonusBeenDistributedThisMonth(group.roomId)) {
          results.skipped++;
          results.details.push({
            roomId: group.roomId,
            creatorId: group.creatorId,
            status: 'skipped',
            message: 'Déjà distribué ce mois-ci',
          });
          continue;
        }

        // Compter les membres
        const messagesRef = collection(db, 'chats', group.roomId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        
        const uniqueUserIds = new Set<string>();
        messagesSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId) {
            uniqueUserIds.add(data.userId);
          }
        });

        const memberCount = uniqueUserIds.size;

        if (memberCount === 0) {
          results.skipped++;
          results.details.push({
            roomId: group.roomId,
            creatorId: group.creatorId,
            status: 'skipped',
            memberCount: 0,
            message: 'Aucun membre',
          });
          continue;
        }

        // Distribuer le bonus
        const bonusAmount = memberCount * 0.01;
        await rewardMonthlyBonus(group.roomId, group.creatorId, memberCount);
        
        // Marquer comme distribué
        await markBonusAsDistributed(group.roomId, group.creatorId, memberCount, bonusAmount);

        results.distributed++;
        results.details.push({
          roomId: group.roomId,
          creatorId: group.creatorId,
          status: 'distributed',
          memberCount,
          bonusAmount,
        });
      } catch (error: any) {
        results.errors++;
        results.details.push({
          roomId: group.roomId,
          creatorId: group.creatorId,
          status: 'error',
          message: error.message,
        });
        console.error(`Erreur pour le groupe ${group.roomId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Distribution automatique terminée: ${results.distributed} distribué(s), ${results.skipped} ignoré(s), ${results.errors} erreur(s)`,
      summary: {
        total: results.total,
        distributed: results.distributed,
        skipped: results.skipped,
        errors: results.errors,
      },
      details: results.details,
    });
  } catch (error: any) {
    console.error('Erreur lors de la distribution automatique:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la distribution automatique', 
        details: error.message,
        partialResults: results,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallet/monthly-bonus?roomId=xxx
 * Récupère le nombre de membres d'un groupe
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId est requis' },
        { status: 400 }
      );
    }

    // Compter le nombre de membres uniques dans le groupe
    const messagesRef = collection(db, 'chats', roomId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const uniqueUserIds = new Set<string>();
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        uniqueUserIds.add(data.userId);
      }
    });

    const memberCount = uniqueUserIds.size;
    const potentialBonus = memberCount * 0.01;

    return NextResponse.json({
      roomId,
      memberCount,
      potentialBonus,
    });
  } catch (error: any) {
    console.error('Erreur lors du calcul du nombre de membres:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul du nombre de membres', details: error.message },
      { status: 500 }
    );
  }
}

