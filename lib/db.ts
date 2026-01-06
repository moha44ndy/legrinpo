// Configuration de la base de données
// Utilise Supabase en production, MySQL en développement local

import mysql from 'mysql2/promise';
import { query as supabaseQuery } from './db-supabase';

// Détecter si on utilise Supabase ou MySQL
const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Configuration MySQL (pour le développement local)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'groupe_po_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Créer un pool de connexions MySQL
let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool | any {
  if (useSupabase) {
    // Retourner le client Supabase
    const { getDbPool: getSupabasePool } = require('./db-supabase');
    return getSupabasePool();
  }
  
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Fonction utilitaire pour exécuter des requêtes
export async function query(sql: string, params?: any[]): Promise<any> {
  // Utiliser Supabase si configuré, sinon MySQL
  if (useSupabase) {
    return supabaseQuery(sql, params);
  }
  
  // Utiliser MySQL pour le développement local
  const connection = await getDbPool().getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

