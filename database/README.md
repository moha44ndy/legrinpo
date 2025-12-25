# Configuration de la Base de Données

## Installation MySQL

### 1. Installer MySQL/MariaDB

Si vous utilisez MAMP (Windows/Mac) :
- MySQL est déjà inclus avec MAMP
- Accédez à phpMyAdmin : http://localhost/phpMyAdmin

Si vous utilisez XAMPP :
- MySQL est inclus avec XAMPP
- Accédez à phpMyAdmin : http://localhost/phpmyadmin

### 2. Exécuter le script SQL

**Option A : Via phpMyAdmin**
1. Ouvrez phpMyAdmin dans votre navigateur
2. Cliquez sur l'onglet "SQL"
3. Copiez le contenu du fichier `schema.sql`
4. Collez-le dans la zone de texte
5. Cliquez sur "Exécuter"

**Option B : Via la ligne de commande**
```bash
# Windows (avec MAMP)
C:\MAMP\bin\mysql\bin\mysql.exe -u root -p < database/schema.sql

# Mac (avec MAMP)
/Applications/MAMP/Library/bin/mysql -u root -p < database/schema.sql

# Linux
mysql -u root -p < database/schema.sql
```

### 3. Vérifier la création

Dans phpMyAdmin, vous devriez voir :
- Base de données : `groupe_po_db`
- Tables créées :
  - `users`
  - `wallets`
  - `transactions`
  - `rooms`
  - `messages`
  - `message_reactions`
  - `user_room_history`
  - `user_favorites`
  - `user_unread_rooms`

## Configuration de l'Application

### Créer un fichier `.env.local`

Créez un fichier `.env.local` à la racine du projet :

```env
# Base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=groupe_po_db

# Firebase (si vous continuez à utiliser Firebase pour le chat en temps réel)
NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id
```

### Note importante

Actuellement, l'application utilise Firebase Firestore pour le chat en temps réel. Si vous voulez utiliser MySQL pour tout, il faudra :
1. Créer des API routes Next.js pour remplacer les appels Firebase
2. Utiliser WebSockets ou Server-Sent Events pour le temps réel
3. Modifier les hooks et composants

## Utilisateur de test

Le script crée un utilisateur de test :
- **Email** : test@example.com
- **Mot de passe** : test123
- **Username** : testuser
- **Solde initial** : 100 points

## Structure des Tables

### users
Stocke les informations des utilisateurs

### wallets
Portefeuilles des utilisateurs avec leur solde

### transactions
Historique de toutes les transactions (gains/dépenses)

### rooms
Discussions/salons (publics et privés)

### messages
Messages dans les discussions

### message_reactions
Réactions (likes) sur les messages

### user_room_history
Historique des discussions créées/rejointes par chaque utilisateur

### user_favorites
Discussions favorites des utilisateurs

### user_unread_rooms
Discussions non lues par utilisateur

