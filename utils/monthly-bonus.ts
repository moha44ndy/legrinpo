/**
 * Utilitaires pour le bonus mensuel des créateurs de groupes
 */

/**
 * Distribue le bonus mensuel à un créateur de groupe
 * @param roomId - L'ID du salon/groupe
 * @param creatorId - L'ID du créateur du groupe
 */
export async function distributeMonthlyBonus(roomId: string, creatorId: string): Promise<void> {
  try {
    const response = await fetch('/api/wallet/monthly-bonus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId,
        creatorId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la distribution du bonus');
    }

    const result = await response.json();
    console.log('Bonus mensuel distribué:', result);
    return result;
  } catch (error) {
    console.error('Erreur lors de la distribution du bonus mensuel:', error);
    throw error;
  }
}

/**
 * Récupère le nombre de membres et le bonus potentiel d'un groupe
 * @param roomId - L'ID du salon/groupe
 */
export async function getGroupStats(roomId: string): Promise<{
  memberCount: number;
  potentialBonus: number;
}> {
  try {
    const response = await fetch(`/api/wallet/monthly-bonus?roomId=${encodeURIComponent(roomId)}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la récupération des statistiques');
    }

    const result = await response.json();
    return {
      memberCount: result.memberCount,
      potentialBonus: result.potentialBonus,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
}

