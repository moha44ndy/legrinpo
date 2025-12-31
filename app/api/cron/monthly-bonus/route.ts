import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { rewardMonthlyBonus } from '@/utils/wallet';

/**
 * API Route pour cron job - Distribution automatique du bonus mensuel
 * 
 * Cette route peut être appelée par un service de cron (Vercel Cron, GitHub Actions, etc.)
 * 
 * GET /api/cron/monthly-bonus
 * 
 * Pour sécuriser, vous pouvez ajouter un secret dans les headers:
 * X-Cron-Secret: votre_secret
 */

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
 * Trouve tous les groupes et leurs créateurs depuis la collection rooms_metadata
 */
async function getAllGroupsWithCreators(): Promise<Array<{ roomId: string; creatorId: string }>> {
  const groups: Array<{ roomId: string; creatorId: string }> = [];
  
  try {
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
  } catch (error) {
    console.error('Erreur lors de la récupération des groupes:', error);
  }
  
  return groups;
}

/**
 * Compte le nombre de membres uniques dans un groupe
 */
async function countGroupMembers(roomId: string): Promise<number> {
  try {
    const messagesRef = collection(db, 'chats', roomId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const uniqueUserIds = new Set<string>();
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        uniqueUserIds.add(data.userId);
      }
    });
    
    return uniqueUserIds.size;
  } catch (error) {
    console.error(`Erreur lors du comptage des membres pour ${roomId}:`, error);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret si configuré (optionnel)
    const cronSecret = request.headers.get('X-Cron-Secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const results = {
      total: 0,
      distributed: 0,
      skipped: 0,
      errors: 0,
      totalBonusDistributed: 0,
      details: [] as Array<{
        roomId: string;
        creatorId: string;
        status: 'distributed' | 'skipped' | 'error';
        memberCount?: number;
        bonusAmount?: number;
        message?: string;
      }>,
    };

    // Récupérer tous les groupes avec leurs créateurs
    const groups = await getAllGroupsWithCreators();
    results.total = groups.length;

    if (groups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun groupe trouvé',
        summary: results,
      });
    }

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
        const memberCount = await countGroupMembers(group.roomId);

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
        results.totalBonusDistributed += bonusAmount;
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
        totalBonusDistributed: results.totalBonusDistributed.toFixed(3),
      },
      details: results.details,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erreur lors de la distribution automatique:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la distribution automatique', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST pour compatibilité
export async function POST(request: NextRequest) {
  return GET(request);
}

