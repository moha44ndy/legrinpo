# PWA et Service Worker (Legrinpo)

## Ce qui est en place

- **next-pwa** (`@ducanh2912/next-pwa`) génère un **service worker** au build production.
- Le SW est enregistré explicitement au chargement de l’app via `PwaSwRegistration`.
- Stratégie de cache : **NetworkFirst** pour les pages principales (/, /canaldiscussion, /chat, /login) avec fallback hors ligne sur `/~offline`.

## Pour que PWA Builder (et les audits) voient le service worker

1. **Build production**  
   Le service worker est créé **uniquement** lors de :
   ```bash
   npm run build
   ```
   Les fichiers sont générés dans `public/` (ex. `sw.js`, `workbox-*.js`, `worker-*.js`).

2. **Déploiement**  
   Déployer le résultat du build en incluant le dossier **public** à la racine du site, pour que :
   - `https://www.legrinpo.com/sw.js` soit accessible ;
   - les autres assets Workbox le soient aussi.

3. **Re-tester**  
   Après un déploiement correct, relancer le rapport PWA Builder :  
   https://www.pwabuilder.com/reportcard?site=https://www.legrinpo.com

En **développement** (`npm run dev`), le service worker est **désactivé** par next-pwa pour éviter les conflits de cache.

## En résumé

| Environnement | Service worker |
|---------------|----------------|
| `npm run dev` | Désactivé |
| `npm run build` puis déploiement | Généré et servi depuis `public/sw.js` |

Si le rapport indique encore « Add a service worker », vérifier que le site en production a bien été déployé après un `npm run build` et que `/sw.js` répond bien (pas de 404).
