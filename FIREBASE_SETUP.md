# Configuration Firebase Authentication

## Problème : "Opération non autorisée"

Si vous rencontrez l'erreur "Opération non autorisée" lors de l'inscription, cela signifie que l'authentification par email/mot de passe n'est pas activée dans votre projet Firebase.

## Solution : Activer l'authentification par email/mot de passe

### Étapes à suivre :

1. **Accédez à la Console Firebase**
   - Allez sur [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Sélectionnez votre projet (canaldiscussion1)

2. **Activez Authentication**
   - Dans le menu de gauche, cliquez sur **"Authentication"**
   - Si c'est la première fois, cliquez sur **"Get started"**

3. **Activez la méthode Email/Password**
   - Cliquez sur l'onglet **"Sign-in method"** (Méthodes de connexion)
   - Dans la liste, trouvez **"Email/Password"**
   - Cliquez dessus
   - Activez le toggle **"Enable"** (Activer)
   - Cliquez sur **"Save"** (Enregistrer)

4. **Vérifiez les règles Firestore**
   - Allez dans **"Firestore Database"**
   - Cliquez sur **"Rules"** (Règles)
   - Assurez-vous que les règles permettent la lecture/écriture pour les utilisateurs authentifiés :

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
  }
}
```

## Vérification

Après avoir activé l'authentification par email/mot de passe, essayez à nouveau de créer un compte. L'erreur devrait disparaître.

## Note importante

Si vous utilisez un projet Firebase existant, assurez-vous que :
- Le projet est bien configuré
- Les variables d'environnement dans `.env.local` sont correctes
- L'authentification est activée dans la console Firebase

