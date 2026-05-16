/**
 * Applique database/migration-user-moderation.sql sur Supabase.
 * Usage: node scripts/apply-moderation-migration.js
 * Nécessite DATABASE_URL (connexion Postgres directe Supabase) dans .env.local
 */

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

async function main() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.log(
      'DATABASE_URL non défini. Exécutez le SQL manuellement dans Supabase :\n' +
        '  database/migration-user-moderation.sql'
    );
    process.exit(0);
  }

  const { Client } = require('pg');
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'migration-user-moderation.sql'),
    'utf8'
  );

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Migration modération appliquée avec succès.');
}

main().catch((err) => {
  console.error('Erreur migration:', err.message);
  process.exit(1);
});
