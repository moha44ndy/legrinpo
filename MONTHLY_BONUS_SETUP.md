# Configuration du Bonus Mensuel Automatique

## 🎯 Vue d'ensemble

Le système de bonus mensuel est maintenant **automatisé**. Le bonus est distribué automatiquement chaque mois aux créateurs de groupes.

## 📋 Fonctionnement

### Distribution Automatique

Le bonus mensuel est distribué automatiquement :
- **Quand** : Le 1er de chaque mois à minuit (00:00 UTC)
- **Qui** : Tous les créateurs de groupes privés
- **Montant** : 0.01 FCFA × nombre de membres dans le groupe

### Protection contre les doublons

Le système vérifie automatiquement si le bonus a déjà été distribué ce mois-ci pour éviter les doublons.

## 🔧 Configuration

### Option 1 : Vercel Cron (Recommandé)

Si vous déployez sur Vercel, le fichier `vercel.json` est déjà configuré pour exécuter automatiquement le cron job.

1. Assurez-vous que `vercel.json` est présent à la racine du projet
2. Déployez sur Vercel
3. Le cron job s'exécutera automatiquement chaque mois

### Option 2 : Cron Job Externe

Vous pouvez configurer un cron job externe pour appeler l'API :

```bash
# Exemple avec curl (à exécuter le 1er de chaque mois)
curl -X GET https://votre-domaine.com/api/cron/monthly-bonus \
  -H "X-Cron-Secret: votre_secret_ici"
```

#### Configuration avec GitHub Actions

Créez `.github/workflows/monthly-bonus.yml` :

```yaml
name: Monthly Bonus Distribution

on:
  schedule:
    - cron: '0 0 1 * *'  # Le 1er de chaque mois à minuit UTC
  workflow_dispatch:  # Permet de déclencher manuellement

jobs:
  distribute-bonus:
    runs-on: ubuntu-latest
    steps:
      - name: Distribute Monthly Bonus
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/monthly-bonus \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

#### Configuration avec un serveur Linux

Ajoutez dans votre crontab (`crontab -e`) :

```bash
# Distribuer le bonus mensuel le 1er de chaque mois à minuit
0 0 1 * * curl -X GET https://votre-domaine.com/api/cron/monthly-bonus -H "X-Cron-Secret: votre_secret"
```

### Sécurité (Optionnel)

Pour sécuriser l'endpoint cron, ajoutez un secret dans `.env.local` :

```env
CRON_SECRET=votre_secret_super_securise
```

L'API vérifiera automatiquement ce secret si configuré.

## 📊 API Endpoints

### 1. Distribution Automatique (Cron)

```
GET /api/cron/monthly-bonus
POST /api/cron/monthly-bonus
```

Distribue le bonus à **tous** les créateurs de groupes.

**Headers (optionnel)** :
- `X-Cron-Secret`: Votre secret si configuré

**Réponse** :
```json
{
  "success": true,
  "message": "Distribution automatique terminée: 5 distribué(s), 2 ignoré(s), 0 erreur(s)",
  "summary": {
    "total": 7,
    "distributed": 5,
    "skipped": 2,
    "errors": 0,
    "totalBonusDistributed": "0.150"
  },
  "details": [...]
}
```

### 2. Distribution Manuelle (Groupe Spécifique)

```
POST /api/wallet/monthly-bonus
Body: { roomId: "group_xxx", creatorId: "user_xxx" }
```

Distribue le bonus pour un groupe spécifique.

### 3. Distribution Automatique (Tous les Groupes)

```
POST /api/wallet/monthly-bonus
Body: { auto: true }
```

Distribue le bonus à tous les groupes (alternative à l'endpoint cron).

## 🔍 Vérification

### Vérifier si le bonus a été distribué

Les distributions sont enregistrées dans Firestore dans la collection `monthly_bonus` avec l'ID :
```
{roomId}_{année-mois}
```

Exemple : `group_abc123_2024-01`

### Vérifier les statistiques d'un groupe

```
GET /api/wallet/monthly-bonus?roomId=group_xxx
```

## 🛠️ Dépannage

### Le bonus n'est pas distribué

1. Vérifiez que les groupes sont enregistrés dans `rooms_metadata`
2. Vérifiez que le cron job s'exécute (logs Vercel/GitHub Actions)
3. Vérifiez les logs de l'API pour les erreurs

### Erreur "Aucun groupe trouvé"

Assurez-vous que les groupes sont enregistrés lors de leur création. Le système enregistre automatiquement les groupes privés créés via l'interface.

### Tester manuellement

Vous pouvez tester la distribution en appelant directement l'API :

```bash
curl -X GET http://localhost:3000/api/cron/monthly-bonus
```

## 📝 Notes

- Les groupes publics (commençant par `public_`) sont ignorés
- Seuls les groupes avec au moins 1 membre reçoivent un bonus
- Le bonus est calculé au moment de la distribution (nombre de membres actuel)
- Les distributions sont tracées pour éviter les doublons

