# Legrinpo – App WebView (même package que la TWA)

Application Android **WebView** qui charge https://www.legrinpo.com avec le **même package name** que la TWA : `com.legrinpo.www.twa`.

Objectif : obtenir l’**accès production** sur Google Play Console avec cette app (WebView), puis pouvoir publier ensuite la version TWA avec le même identifiant sans blocage.

## Prérequis

- **Android Studio** (Hedgehog 2023.1.1 ou plus récent recommandé)
- **JDK 17**
- Un **keystore** pour signer l’app (idéalement le même que pour la TWA, pour garder le même package et la même signature)

## Ouvrir et compiler le projet

1. Ouvrir **Android Studio**.
2. **File → Open** et choisir le dossier `android-webview` (à la racine du repo Legrinpo).
3. Attendre la **synchronisation Gradle** (Sync Now si demandé).
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)** pour un APK de test, ou **Build → Generate Signed Bundle / APK** pour un AAB signé pour le Play Store.

## Signer pour le Play Store (même package que la TWA)

Pour pouvoir remplacer plus tard par la TWA sans changer d’application sur le Play Store, il faut signer cette WebView avec **le même keystore** que celui utilisé pour la TWA (celui dont l’empreinte est dans `public/.well-known/assetlinks.json`).

1. **Build → Generate Signed Bundle / APK**.
2. Choisir **Android App Bundle** (recommandé pour le Play Store).
3. Sélectionner ou créer un keystore :
   - Si vous avez déjà un keystore pour la TWA (même `com.legrinpo.www.twa`), utilisez-le.
   - Sinon, créez un keystore et conservez-le pour signer aussi la TWA plus tard.
4. Renseigner l’alias et les mots de passe.
5. Choisir **release**, puis **Finish**.

## Upload sur Google Play Console

1. Aller sur [Google Play Console](https://play.google.com/console).
2. Créer une application (ou utiliser celle qui existe déjà pour Legrinpo).
3. **Production** (ou **Tests internes** pour tester) → **Créer une version**.
4. Téléverser le **AAB** généré.
5. Renseigner la fiche store (description, captures, etc.) et envoyer en revue.

Une fois l’accès production obtenu avec cette WebView, vous pourrez publier la version **TWA** avec le même package name `com.legrinpo.www.twa` et la même signature sans créer une nouvelle fiche Play Store.

## Structure du projet

- **Package** : `com.legrinpo.www.twa` (identique à la TWA).
- **URL chargée** : `https://www.legrinpo.com` (définie dans `MainActivity.kt`).
- **Min SDK** : 24 | **Target SDK** : 34.

Pour changer l’URL plus tard, modifier la constante `legrinpoUrl` dans `app/src/main/java/com/legrinpo/www/twa/MainActivity.kt`.
