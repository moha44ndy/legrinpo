# Publier l’app sur l’App Store et le Google Play Store

Votre projet est prêt pour être distribué comme **PWA** (installable depuis le navigateur) et comme **app native** (App Store / Play Store) via **Capacitor**.

---

## 1. PWA (installable depuis le navigateur)

Déjà en place dans le projet :

- **Manifest** : `app/manifest.ts` (nom, icônes, mode standalone).
- **Méta pour iOS/Android** : dans `app/layout.tsx` (apple-mobile-web-app-capable, theme-color).
- **Service worker** (optionnel) : installez `@ducanh2912/next-pwa` puis `npm run build` pour activer le cache hors ligne.

### Icônes PWA

Ajoutez vos icônes dans `public/icons/` :

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Voir `public/icons/README.txt`. Sans ces fichiers, l’installation PWA peut ne pas proposer d’icône.

Les utilisateurs pourront **« Ajouter à l’écran d’accueil »** sur iPhone et Android.

---

## 2. App Store et Google Play avec Capacitor

Capacitor enveloppe votre site dans une app iOS/Android. L’app peut **charger votre site en ligne** (recommandé) ou un export statique.

### Prérequis

- **Node.js** 18+
- **Compte Apple Developer** (99 USD/an) pour l’App Store
- **Compte Google Play Console** (25 USD une fois) pour le Play Store
- **macOS + Xcode** pour générer l’archive iOS (obligatoire pour l’App Store)
- **Android Studio** pour générer le bundle Android (Windows/macOS/Linux)

### Installation Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

Le projet contient déjà un `capacitor.config.ts` et un dossier `cap-web/` avec une page de redirection.

### Charger votre site en production (recommandé)

1. Déployez votre site Next.js en production (Vercel, votre hébergement, etc.) et notez l’URL (ex. `https://votre-domaine.com`).
2. Dans `capacitor.config.ts`, décommentez et remplissez `server.url` :

   ```ts
   server: {
     url: 'https://votre-domaine.com',
     cleartext: true,  // à garder en dev si besoin, en prod pas nécessaire si HTTPS
   },
   ```

3. Mettez à jour `cap-web/index.html` : remplacez `https://VOTRE-DOMAINE.com` par la même URL (pour le fallback si l’app ouvre la page locale).

L’app native sera alors une WebView qui affiche directement votre site en ligne (même logique, même back-end, pas de double déploiement).

### Ajouter les plateformes et ouvrir les projets

```bash
npx cap add ios
npx cap add android
npx cap sync
```

Ensuite :

- **iOS** : `npx cap open ios` → ouvre Xcode. Configure la signature (Team, identifiant), puis **Product → Archive** pour créer l’archive à envoyer à l’App Store.
- **Android** : `npx cap open android` → ouvre Android Studio. **Build → Generate Signed Bundle / APK** pour créer le AAB à envoyer au Play Store.

### Soumettre aux stores

- **App Store** : Xcode → **Window → Organizer** → choisir l’archive → **Distribute App** → App Store Connect. Dans App Store Connect, créez l’app, remplissez fiche, captures d’écran, politique de confidentialité, etc., puis soumettez en révision.
- **Google Play** : Play Console → Créer une application → remplir fiche, contenu, politique de confidentialité, puis téléverser le AAB et soumettre en révision.

### Récap des commandes utiles

```bash
# Après modification du site ou de la config
npx cap sync

# Ouvrir le projet natif
npx cap open ios
npx cap open android
```

---

## 3. Checklist avant soumission

- [ ] **Icônes** : 192×192 et 512×512 dans `public/icons/`, et icône haute résolution pour les stores (ex. 1024×1024 pour Apple).
- [ ] **URL de production** : `server.url` dans `capacitor.config.ts` et `cap-web/index.html` pointent vers votre vrai domaine en HTTPS.
- [ ] **Politique de confidentialité** : URL accessible (souvent obligatoire sur les deux stores).
- [ ] **Comptes** : Apple Developer, Google Play Console, et éventuellement identifiants de test pour les relecteurs.

Une fois tout cela en place, votre application web devient une app téléchargeable sur l’App Store et le Google Play Store.
