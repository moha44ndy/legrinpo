# Migration PHP vers Next.js - Guide

## ✅ Fichiers Créés

### Structure Next.js
- `package.json` - Dépendances et scripts
- `tsconfig.json` - Configuration TypeScript
- `next.config.js` - Configuration Next.js
- `.gitignore` - Fichiers à ignorer

### Pages
- `app/layout.tsx` - Layout principal
- `app/page.tsx` - Page d'accueil (redirige vers canaldiscussion)
- `app/canaldiscussion/page.tsx` - Page de sélection de salon (remplace `canaldiscussion.php`)
- `app/chat/page.tsx` - Page de chat (remplace `chat.php`)

### Composants
- `components/Toast.tsx` - Système de notifications toast

### Hooks
- `hooks/useChat.ts` - Hook personnalisé pour gérer le chat Firebase

### Utilitaires
- `lib/firebase.ts` - Configuration Firebase
- `utils/storage.ts` - Gestion localStorage (historique des salons)
- `utils/toast.ts` - Gestion des toasts

### CSS
- `public/css/styles-canaldiscussion.css` - Styles pour la page canal de discussion
- `public/css/chat_de_discussion.css` - Styles pour la page chat

## 🔄 Changements Principaux

### 1. Authentification
- **Avant** : Sessions PHP (`$_SESSION`, `isLoggedIn()`)
- **Après** : À implémenter avec NextAuth.js ou un système d'authentification personnalisé
- **Note** : Actuellement simulé avec `username` et `userId` en dur

### 2. Base de Données
- **Avant** : MySQL via PDO (`connection.php`)
- **Après** : Firebase Firestore pour le chat en temps réel
- **Note** : Les données utilisateur/artistes nécessitent toujours une base MySQL ou une migration vers Firebase

### 3. Chat en Temps Réel
- **Avant** : Firebase côté client (JavaScript dans `chat.php`)
- **Après** : Hook React `useChat` qui encapsule la logique Firebase
- **Amélioration** : Code plus modulaire et réutilisable

### 4. Gestion d'État
- **Avant** : Variables JavaScript globales
- **Après** : React Hooks (`useState`, `useEffect`, hooks personnalisés)

### 5. Routing
- **Avant** : URLs PHP (`canaldiscussion.php`, `chat.php?room=...`)
- **Après** : Next.js App Router (`/canaldiscussion`, `/chat?room=...`)

## 📋 À Faire

### Authentification Réelle
1. Implémenter NextAuth.js ou un système d'authentification
2. Créer des API routes pour login/logout
3. Protéger les routes avec middleware

### Base de Données Utilisateurs
1. Migrer les données utilisateurs vers Firebase ou créer des API routes pour MySQL
2. Créer des API routes pour vérifier le statut artiste
3. Implémenter la gestion des profils utilisateurs

### Améliorations
1. Ajouter la gestion des fichiers/images dans le chat
2. Implémenter les notifications push
3. Ajouter des tests unitaires
4. Optimiser les performances (code splitting, lazy loading)

## 🚀 Démarrage Rapide

1. Installer les dépendances :
```bash
npm install
```

2. Configurer Firebase :
   - Créer un fichier `.env.local`
   - Ajouter vos identifiants Firebase

3. Lancer le serveur de développement :
```bash
npm run dev
```

4. Ouvrir [http://localhost:3000](http://localhost:3000)

## 📝 Notes Importantes

- Les fichiers CSS originaux ont été conservés dans `public/css/`
- L'historique des salons utilise toujours localStorage (comme avant)
- Le système de toasts a été amélioré avec React
- Firebase est configuré avec des valeurs par défaut (à remplacer par vos propres identifiants)

