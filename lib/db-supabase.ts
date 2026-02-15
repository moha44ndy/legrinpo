// Adaptateur Supabase – exécution des requêtes SQL via l’API Supabase

import { supabaseAdmin } from './supabase';

/**
 * Fonction utilitaire pour exécuter des requêtes via Supabase
 * Convertit les requêtes SQL en appels API Supabase
 */
export async function query(sql: string, params?: any[]): Promise<any> {
  if (!supabaseAdmin) {
    throw new Error('Supabase n\'est pas configuré. Vérifiez vos variables d\'environnement NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
  }

  try {
    // Parser la requête SQL pour déterminer le type
    const trimmedSql = sql.trim().toUpperCase();
    const sqlLower = sql.trim().toLowerCase();
    
    // SELECT queries
    if (trimmedSql.startsWith('SELECT')) {
      return await handleSelect(sql, params);
    }
    
    // INSERT queries
    if (trimmedSql.startsWith('INSERT')) {
      return await handleInsert(sql, params);
    }
    
    // UPDATE queries
    if (trimmedSql.startsWith('UPDATE')) {
      return await handleUpdate(sql, params);
    }
    
    // DELETE queries
    if (trimmedSql.startsWith('DELETE')) {
      return await handleDelete(sql, params);
    }
    
    // Pour les autres requêtes, utiliser rpc ou exécuter directement
    // Note: Supabase permet d'exécuter du SQL brut via rpc si vous créez une fonction PostgreSQL
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query_text: sql,
      params_array: params || [],
    });

    if (error) {
      console.error('Erreur SQL:', sql);
      console.error('Paramètres:', params);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Erreur lors de l\'exécution de la requête:', error);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

// Helper pour les requêtes SELECT
async function handleSelect(sql: string, params?: any[]): Promise<any> {
  // Extraire le nom de la table depuis la requête SELECT
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('Impossible de déterminer la table dans la requête SELECT');
  }
  
  const tableName = tableMatch[1];
  
  // Extraire les conditions WHERE
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
  const whereClause = whereMatch ? whereMatch[1] : null;
  
  // Pour l'instant, utiliser une approche simplifiée
  // Dans un vrai projet, vous devriez parser complètement la requête SQL
  // ou utiliser l'API Supabase directement dans votre code
  
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin n\'est pas initialisé');
  }
  
  let queryBuilder: any = supabaseAdmin.from(tableName).select('*');
  
  // Appliquer les conditions WHERE simples
  if (whereClause && params) {
    // Parser les conditions WHERE basiques (ex: "email = ?")
    const conditions = parseWhereClause(whereClause, params);
    conditions.forEach((condition: { column: string; value: any }) => {
      queryBuilder = queryBuilder.eq(condition.column, condition.value);
    });
  }
  
  const { data, error } = await queryBuilder;
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

// Helper pour les requêtes INSERT
async function handleInsert(sql: string, params?: any[]): Promise<any> {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('Impossible de déterminer la table dans la requête INSERT');
  }
  
  const tableName = tableMatch[1];
  
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin n\'est pas initialisé');
  }
  
  // Extraire les colonnes et valeurs
  const columnsMatch = sql.match(/\(([^)]+)\)/g);
  if (!columnsMatch || columnsMatch.length < 2) {
    throw new Error('Format INSERT non supporté');
  }
  
  const columns = columnsMatch[0].replace(/[()]/g, '').split(',').map(c => c.trim());
  const values = params || [];
  
  // Construire l'objet à insérer
  const insertData: any = {};
  columns.forEach((col, index) => {
    if (values[index] !== undefined) {
      insertData[col] = values[index];
    }
  });
  
  const { data, error } = await supabaseAdmin.from(tableName).insert(insertData).select();
  
  if (error) {
    throw error;
  }
  
  // Retourner un format compatible (avec insertId)
  return {
    insertId: data && data[0] ? data[0].id : null,
    ...data?.[0],
  };
}

// Helper pour les requêtes UPDATE
async function handleUpdate(sql: string, params?: any[]): Promise<any> {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('Impossible de déterminer la table dans la requête UPDATE');
  }
  
  const tableName = tableMatch[1];
  
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin n\'est pas initialisé');
  }
  
  // Extraire SET et WHERE
  const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
  const whereMatch = sql.match(/WHERE\s+(.+?)$/i);
  
  if (!setMatch) {
    throw new Error('Format UPDATE non supporté');
  }
  
  // Parser SET clause
  const setClause = setMatch[1];
  const updateData: any = {};
  
  // Parser simple: "col1 = ?, col2 = ?"
  const setParts = setClause.split(',').map(s => s.trim());
  let paramIndex = 0;
  
  setParts.forEach(part => {
    const [column, value] = part.split('=').map(s => s.trim());
    if (value === '?') {
      updateData[column] = params?.[paramIndex++];
    } else {
      updateData[column] = value.replace(/['"]/g, '');
    }
  });
  
  let queryBuilder: any = supabaseAdmin.from(tableName).update(updateData);
  
  // Appliquer WHERE
  if (whereMatch && params) {
    const conditions = parseWhereClause(whereMatch[1], params.slice(paramIndex));
    conditions.forEach((condition: { column: string; value: any }) => {
      queryBuilder = queryBuilder.eq(condition.column, condition.value);
    });
  }
  
  const { data, error } = await queryBuilder.select();
  
  if (error) {
    throw error;
  }
  
  return data;
}

// Helper pour les requêtes DELETE
async function handleDelete(sql: string, params?: any[]): Promise<any> {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('Impossible de déterminer la table dans la requête DELETE');
  }
  
  const tableName = tableMatch[1];
  
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin n\'est pas initialisé');
  }
  
  const whereMatch = sql.match(/WHERE\s+(.+?)$/i);
  
  let queryBuilder: any = supabaseAdmin.from(tableName).delete();
  
  if (whereMatch && params) {
    const conditions = parseWhereClause(whereMatch[1], params);
    conditions.forEach((condition: { column: string; value: any }) => {
      queryBuilder = queryBuilder.eq(condition.column, condition.value);
    });
  }
  
  const { data, error } = await queryBuilder.select();
  
  if (error) {
    throw error;
  }
  
  return data;
}

// Parser simple pour WHERE clause (ex: "email = ?" ou "id = ?")
function parseWhereClause(whereClause: string, params: any[]): Array<{ column: string; value: any }> {
  const conditions: Array<{ column: string; value: any }> = [];
  let paramIndex = 0;
  
  // Parser simple pour "column = ?" ou "column = value"
  const parts = whereClause.split(/\s+AND\s+|\s+OR\s+/i);
  
  parts.forEach(part => {
    const match = part.match(/(\w+)\s*=\s*\?/);
    if (match && params[paramIndex] !== undefined) {
      conditions.push({
        column: match[1],
        value: params[paramIndex++],
      });
    }
  });
  
  return conditions;
}

// Fonction pour obtenir le pool (compatibilité avec l'ancien code)
export function getDbPool() {
  return supabaseAdmin;
}
