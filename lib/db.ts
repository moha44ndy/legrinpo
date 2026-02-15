// Base de données : Supabase uniquement

import { query as supabaseQuery } from './db-supabase';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('NEXT_PUBLIC_SUPABASE_URL non défini. Les requêtes DB échoueront.');
}

export function getDbPool() {
  const { getDbPool: getSupabasePool } = require('./db-supabase');
  return getSupabasePool();
}

export async function query(sql: string, params?: any[]): Promise<any> {
  return supabaseQuery(sql, params);
}
