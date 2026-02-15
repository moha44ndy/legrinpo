# Base de données – Supabase

Le projet utilise **Supabase** comme base de données (local et production).

## Configuration

Dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Tables / schéma

Les tables sont gérées dans Supabase (Dashboard → Table Editor ou SQL Editor).

- **password_reset_tokens** : exécuter le script `supabase-password-reset-tokens.sql` dans le SQL Editor Supabase si besoin.

Les autres tables (users, wallets, withdrawal_requests, etc.) sont créées via le Dashboard Supabase ou vos migrations.
