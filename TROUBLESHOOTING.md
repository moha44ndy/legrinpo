# Guide de Dépannage - Inscription et Connexion

## 🔍 Problèmes Courants et Solutions

### 1. Erreur "Opération non autorisée" / "operation-not-allowed"

**Cause** : L'authentification par email/mot de passe n'est pas activée dans Firebase.

**Solution** :
1. Allez sur [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Sélectionnez votre projet (canaldiscussion1)
3. Cliquez sur **"Authentication"** dans le menu de gauche
4. Si c'est la première fois, cliquez sur **"Get started"**
5. Cliquez sur l'onglet **"Sign-in method"**
6. Trouvez **"Email/Password"** dans la liste
7. Cliquez dessus et activez le toggle **"Enable"**
8. Cliquez sur **"Save"**

### 2. Erreur "Firebase Auth n'est pas initialisé"

**Cause** : Problème de configuration Firebase ou variables d'environnement manquantes.

**Solution** :
1. Vérifiez que le fichier `.env.local` existe à la racine du projet
2. Vérifiez qu'il contient toutes les variables Firebase :
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id
   ```
3. Redémarrez le serveur de développement après modification de `.env.local` :
   ```bash
   # Arrêtez le serveur (Ctrl+C)
   npm run dev
   ```

### 3. Erreur "Permission denied" / Règles Firestore

**Cause** : Les règles Firestore bloquent l'accès.

**Solution** :
1. Allez dans la console Firebase > **Firestore Database** > **Rules**
2. Assurez-vous que les règles permettent la lecture/écriture pour les utilisateurs authentifiés :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permettre aux utilisateurs authentifiés de lire/écrire leurs propres données
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permettre aux utilisateurs authentifiés de lire/écrire dans les chats
    match /chats/{chatId}/messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Permettre aux utilisateurs authentifiés de lire/écrire leurs portefeuilles
    match /wallets/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /wallets/{userId}/transactions/{transactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permettre la création de profils utilisateur lors de l'inscription
    match /users/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      allow read, update: if request.auth != null && request.auth.uid == userId;
    }
    
    // Métadonnées des groupes
    match /rooms_metadata/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    // Bonus mensuel
    match /monthly_bonus/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Erreur "Network request failed"

**Cause** : Problème de connexion internet ou CORS.

**Solution** :
1. Vérifiez votre connexion internet
2. Vérifiez que vous n'êtes pas derrière un proxy/firewall qui bloque Firebase
3. Vérifiez la console du navigateur (F12) pour plus de détails

### 5. Le formulaire ne se soumet pas / Pas d'erreur visible

**Solution** :
1. Ouvrez la console du navigateur (F12 > Console)
2. Regardez les erreurs affichées
3. Vérifiez l'onglet Network pour voir si les requêtes Firebase sont envoyées
4. Vérifiez que le serveur de développement est bien démarré

### 6. Erreur "Email already in use"

**Cause** : L'email est déjà utilisé par un autre compte.

**Solution** : Utilisez un autre email ou connectez-vous avec le compte existant.

## 🔧 Vérifications à Faire

### 1. Vérifier la configuration Firebase

Ouvrez la console du navigateur (F12) et tapez :
```javascript
// Vérifier que Firebase est initialisé
console.log(window.firebase || 'Firebase non trouvé');
```

### 2. Vérifier les variables d'environnement

Dans votre terminal, vérifiez que les variables sont bien chargées :
```bash
# Windows PowerShell
Get-Content .env.local | Select-String "FIREBASE"
```

### 3. Tester la connexion Firebase

Dans la console du navigateur, vérifiez les erreurs réseau dans l'onglet Network.

## 📝 Logs de Débogage

Le code affiche maintenant des logs détaillés dans la console :
- "Tentative d'inscription pour: [email]"
- "Utilisateur créé avec succès: [uid]"
- "Profil utilisateur créé dans Firestore"
- "Tentative de connexion pour: [email]"
- "Connexion réussie"

Si vous ne voyez pas ces messages, vérifiez :
1. Que la console du navigateur est ouverte
2. Que le niveau de log n'est pas filtré
3. Que le code s'exécute bien (pas d'erreurs JavaScript avant)

## 🆘 Si Rien Ne Fonctionne

1. **Vérifiez les logs de la console** (F12 > Console)
2. **Vérifiez les requêtes réseau** (F12 > Network)
3. **Vérifiez la configuration Firebase** dans la console Firebase
4. **Redémarrez le serveur** : `npm run dev`
5. **Videz le cache du navigateur** (Ctrl+Shift+Delete)
6. **Testez dans un autre navigateur** ou en navigation privée

## 📞 Informations à Fournir en Cas de Problème

Si le problème persiste, fournissez :
1. Le message d'erreur exact (copié depuis la console)
2. Les logs de la console du navigateur
3. La version de Node.js : `node --version`
4. La version de npm : `npm --version`
5. Le système d'exploitation

