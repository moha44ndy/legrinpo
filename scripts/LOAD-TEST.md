# Test de charge (100k requêtes)

Vérifie si l’app tient la charge en simulant **100 000 requêtes** (mix page d’accueil + canaldiscussion) avec **500 requêtes simultanées**.

## Lancer le test

1. **Démarrer l’app** (autre terminal) :
   ```bash
   npm run build
   npm run start
   ```
   Ou en dev : `npm run dev`

2. **Lancer le test** (100k requêtes, 500 en parallèle) :
   ```bash
   npm run test:load
   ```

3. **Options** :
   ```bash
   node scripts/load-test.js --url https://votre-app.vercel.app
   node scripts/load-test.js --total 10000 --concurrency 200
   ```
   Variables d’environnement : `LOAD_TEST_URL`, `LOAD_TEST_TOTAL`, `LOAD_TEST_CONCURRENCY`.

## Résultat

- **Succès** : au moins 99 % de réponses 2xx/3xx et latence p99 < 5 s.
- **Échec** : trop d’erreurs ou latences trop élevées → regarder serveur, base de données, limites Supabase/Firebase.

## Test rapide (avant le gros run)

Pour valider que tout tourne sans faire 100k requêtes :
```bash
node scripts/load-test.js --total 500 --concurrency 50
```
