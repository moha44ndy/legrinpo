/**
 * Crée ou met à jour le compte démo Legrinpo.
 * Usage: npm run create-demo-user
 *
 * Variables optionnelles (.env.local) :
 *   DEMO_EMAIL, DEMO_PASSWORD, DEMO_USERNAME
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

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

async function ensureFirestoreWallet(uid) {
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const jsonPathRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (jsonPathRaw) {
        const resolved = path.isAbsolute(jsonPathRaw)
          ? jsonPathRaw
          : path.join(process.cwd(), jsonPathRaw.replace(/^\.\//, ''));
        if (fs.existsSync(resolved)) {
          const keyFile = JSON.parse(fs.readFileSync(resolved, 'utf8'));
          admin.initializeApp({ credential: admin.credential.cert(keyFile) });
        }
      } else if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          projectId,
        });
      } else {
        return;
      }
    }

    const db = admin.firestore();
    const ref = db.collection('wallets').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        userId: uid,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Portefeuille Firestore créé pour le compte démo.');
    }
  } catch (e) {
    console.warn('Firestore (portefeuille) ignoré:', e.message);
  }
}

async function main() {
  loadEnvLocal();

  const email = (process.env.DEMO_EMAIL || 'demo@legrinpo.com').trim();
  const password = (process.env.DEMO_PASSWORD || 'DemoLegrinpo2026!').trim();
  const username = (process.env.DEMO_USERNAME || 'DemoReview').trim();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id, uid')
    .eq('email', email)
    .maybeSingle();

  if (findErr) {
    console.error('Erreur Supabase:', findErr.message);
    process.exit(1);
  }

  let uid;

  if (existing) {
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        username,
        display_name: username,
        password_hash: passwordHash,
        terms_accepted_at: now,
        is_disabled: 0,
        is_admin: 0,
        updated_at: now,
      })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('Mise à jour échouée:', updateErr.message);
      process.exit(1);
    }
    uid = existing.uid;
    console.log('Compte démo mis à jour (id=%s).', existing.id);
  } else {
    uid = randomUUID();
    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert({
        uid,
        email,
        username,
        display_name: username,
        password_hash: passwordHash,
        terms_accepted_at: now,
        is_disabled: 0,
        is_admin: 0,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Création échouée:', insertErr.message);
      process.exit(1);
    }
    console.log('Compte démo créé (id=%s).', inserted.id);
  }

  await ensureFirestoreWallet(uid);

  console.log('\n--- Identifiants compte démo ---');
  console.log('Email      :', email);
  console.log('Mot de passe:', password);
  console.log('Pseudo     :', username);
  console.log('\nActivez sur le site : DEMO_LOGIN_ENABLED=true');
  console.log('                      NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true');
  console.log('(bouton « Compte démo » sur /login)\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
