/**
 * Test de charge : simule un grand nombre de requêtes (ex. 100k) pour vérifier
 * si l'app tient la charge (Next.js + DB + Firebase/Supabase).
 *
 * Usage:
 *   node scripts/load-test.js
 *   node scripts/load-test.js --url https://votre-app.vercel.app
 *   node scripts/load-test.js --total 10000 --concurrency 200
 *
 * Variables d'environnement:
 *   LOAD_TEST_URL     Base URL (défaut: http://localhost:3000)
 *   LOAD_TEST_TOTAL   Nombre total de requêtes (défaut: 100000)
 *   LOAD_TEST_CONCURRENCY  Requêtes simultanées (défaut: 500)
 */

function getArg(name, envVal, def) {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1 && process.argv[i + 1]) return name === 'url' ? process.argv[i + 1] : parseInt(process.argv[i + 1], 10);
  if (envVal !== undefined && envVal !== '') return name === 'url' ? envVal : parseInt(envVal, 10);
  return def;
}

const BASE_URL_FINAL = getArg('url', process.env.LOAD_TEST_URL, 'http://localhost:3000');
const TOTAL_REQUESTS = getArg('total', process.env.LOAD_TEST_TOTAL, 100000);
const CONCURRENCY_FINAL = getArg('concurrency', process.env.LOAD_TEST_CONCURRENCY, 500);

// Endpoints à tester (répartis comme des utilisateurs réels)
const ENDPOINTS = [
  { path: '/', weight: 50 },
  { path: '/canaldiscussion', weight: 50 },
];

function pickEndpoint() {
  const r = Math.random();
  let acc = 0;
  for (const e of ENDPOINTS) {
    acc += e.weight / 100;
    if (r <= acc) return e.path;
  }
  return '/';
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

async function runOne(url) {
  const start = performance.now();
  let status = 0;
  let err = null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'LoadTest/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    status = res.status;
    await res.text();
  } catch (e) {
    err = e.message || String(e);
  }
  const duration = performance.now() - start;
  return { status, duration, err };
}

async function runLoadTest() {
  console.log('--- Test de charge (100k requêtes) ---\n');
  console.log('URL:', BASE_URL_FINAL);
  console.log('Total requêtes:', TOTAL_REQUESTS.toLocaleString());
  console.log('Concurrence:', CONCURRENCY_FINAL);
  console.log('');

  const latencies = [];
  const errorsByType = {};
  let completed = 0;
  let successCount = 0;
  const startTotal = performance.now();

  const runBatch = async (batchUrls) => {
    const results = await Promise.allSettled(batchUrls.map((url) => runOne(url)));
    for (const r of results) {
      completed++;
      if (r.status === 'fulfilled') {
        const { status, duration, err } = r.value;
        latencies.push(duration);
        if (status >= 200 && status < 400) successCount++;
        if (err) {
          errorsByType[err] = (errorsByType[err] || 0) + 1;
        } else if (status >= 400) {
          errorsByType[`HTTP ${status}`] = (errorsByType[`HTTP ${status}`] || 0) + 1;
        }
      } else {
        const err = r.reason?.message || String(r.reason);
        errorsByType[err] = (errorsByType[err] || 0) + 1;
      }
      if (completed % 10000 === 0 && completed > 0) {
        process.stdout.write(`  ${completed.toLocaleString()} / ${TOTAL_REQUESTS.toLocaleString()}\r`);
      }
    }
  };

  const queue = [];
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const path = pickEndpoint();
    queue.push(BASE_URL_FINAL.replace(/\/$/, '') + path);
  }

  for (let i = 0; i < queue.length; i += CONCURRENCY_FINAL) {
    const batch = queue.slice(i, i + CONCURRENCY_FINAL);
    await runBatch(batch);
  }

  const totalTimeMs = performance.now() - startTotal;
  const totalTimeSec = totalTimeMs / 1000;
  const rps = (completed / totalTimeSec).toFixed(1);
  const successRate = ((successCount / completed) * 100).toFixed(2);

  latencies.sort((a, b) => a - b);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  console.log('\n--- Résultats ---\n');
  console.log('Requêtes totales:', completed.toLocaleString());
  console.log('Succès (2xx/3xx):', successCount.toLocaleString(), `(${successRate}%)`);
  console.log('Durée totale:', totalTimeSec.toFixed(2), 's');
  console.log('Requêtes / seconde:', rps);
  console.log('Latence p50:', p50.toFixed(0), 'ms');
  console.log('Latence p95:', p95.toFixed(0), 'ms');
  console.log('Latence p99:', p99.toFixed(0), 'ms');
  if (Object.keys(errorsByType).length > 0) {
    console.log('\nErreurs:');
    for (const [k, v] of Object.entries(errorsByType)) {
      console.log('  ', k, ':', v.toLocaleString());
    }
  }

  const ok = parseFloat(successRate) >= 99 && p99 < 5000;
  console.log('\n' + (ok ? '✓ L\'app tient la charge (succès ≥99%, p99 < 5s).' : '✗ Problèmes détectés: vérifier serveur, DB et limites (Supabase/Firebase).'));
  process.exit(ok ? 0 : 1);
}

runLoadTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
