# M&Omusic - Next.js Version

Application de chat en temps réel pour la communauté M&Omusic, migrée de PHP vers Next.js.

## 🚀 Installation

```bash
npm install
```

## ⚙️ Configuration

1. Copiez le fichier `.env.example` vers `.env.local` :
```bash
cp .env.example .env.local
```

2. Remplissez les variables d'environnement dans `.env.local` avec vos identifiants Firebase :
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 📁 Structure du Projet

```
├── app/
│   ├── canaldiscussion/    # Page de sélection de salon
│   ├── chat/                # Page de chat en temps réel
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Page d'accueil (redirige vers canaldiscussion)
├── components/
│   └── Toast.tsx            # Composant de notifications
├── hooks/
│   └── useChat.ts           # Hook personnalisé pour le chat Firebase
├── lib/
│   └── firebase.ts          # Configuration Firebase
├── utils/
│   ├── storage.ts           # Utilitaires localStorage
│   └── toast.ts             # Gestion des toasts
└── public/
    └── css/                 # Fichiers CSS
```

## 🛠️ Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 📦 Build de Production

```bash
npm run build
npm start
```

## 🔥 Firebase Configuration

Cette application utilise Firebase Firestore pour le chat en temps réel. Assurez-vous que :

1. Votre projet Firebase est configuré avec Firestore activé
2. Les règles de sécurité Firestore autorisent la lecture/écriture pour votre application
3. Les variables d'environnement sont correctement configurées

## ✨ Fonctionnalités

- ✅ Création de salons privés avec mot de passe
- ✅ Rejoindre des salons publics ou privés
- ✅ Chat en temps réel avec Firebase
- ✅ Historique des salons (localStorage)
- ✅ Modification et suppression de messages
- ✅ Notifications toast
- ✅ Interface responsive

## 📝 Notes

- L'authentification utilisateur est actuellement simulée (à remplacer par un vrai système d'auth)
- Les données sont stockées dans Firebase Firestore
- L'historique des salons est stocké dans localStorage du navigateur

