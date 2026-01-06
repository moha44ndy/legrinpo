// Configuration Supabase pour la base de données PostgreSQL

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Récupérer les variables d'environnement Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client Supabase pour les opérations côté client (lecture seule avec RLS)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Client Supabase pour les opérations côté serveur (bypass RLS)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Fonction utilitaire pour exécuter des requêtes SQL brutes (côté serveur uniquement)
export async function query(sql: string, params?: any[]): Promise<any> {
  if (!supabaseAdmin) {
    throw new Error('Supabase n\'est pas configuré. Vérifiez vos variables d\'environnement.');
  }

  try {
    // Supabase utilise des requêtes paramétrées différemment
    // Pour les requêtes SQL brutes, on utilise rpc ou on construit la requête
    // Note: Supabase préfère l'utilisation de leur API plutôt que SQL brut
    
    // Pour l'instant, on va utiliser une approche hybride
    // Les requêtes simples seront converties en appels API Supabase
    // Les requêtes complexes utiliseront rpc
    
    // Cette fonction sera remplacée par des appels spécifiques à Supabase
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query: sql,
      params: params || [],
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Erreur lors de l\'exécution de la requête Supabase:', error);
    throw error;
  }
}

// Fonction helper pour obtenir le client Supabase approprié
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin n\'est pas configuré');
  }
  return supabaseAdmin;
}

