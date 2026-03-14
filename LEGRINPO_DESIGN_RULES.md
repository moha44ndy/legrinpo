# LEGRINPO — Design Rules
## App Communautaire / Discussions
### Direction : Dark Blue · Desktop + Mobile

---

## PALETTE

```
/* Fonds */
--color-bg:           #0d1526   /* fond principal — bleu très foncé */
--color-surface:      #162040   /* cartes, panneaux — bleu marine */
--color-surface-2:    #1c2d57   /* surface élevée — hover, active */
--color-surface-3:    #243566   /* surface encore plus élevée — modals */

/* Bordures */
--color-border:       rgba(255,255,255,0.07)   /* bordures subtiles */
--color-border-mid:   rgba(255,255,255,0.12)   /* bordures moyennes */
--color-border-strong: rgba(255,255,255,0.2)   /* bordures actives */

/* Accent bleu clair — liens, titres colorés, éléments actifs */
--color-accent:       #4d9fff   /* bleu clair — couleur actuelle des titres */
--color-accent-dim:   rgba(77,159,255,0.15)   /* fond accent très subtil */
--color-accent-glow:  rgba(77,159,255,0.08)   /* glow hover */

/* Texte */
--color-text-1:       #f0f4ff   /* texte primaire — blanc bleuté */
--color-text-2:       #8da0c4   /* texte secondaire */
--color-text-3:       #4d6080   /* texte muted, placeholders */

/* États */
--color-success:      #34d399
--color-success-bg:   rgba(52,211,153,0.12)
--color-error:        #f87171
--color-error-bg:     rgba(248,113,113,0.12)
--color-warning:      #fbbf24
--color-warning-bg:   rgba(251,191,36,0.12)

/* Badge PUB */
--color-pub-bg:       rgba(255,255,255,0.08)
--color-pub-text:     rgba(255,255,255,0.5)
```

---

## 1. ROOT LAYOUT

- `html, body` : width 100%, height 100%, margin 0, padding 0, overflow-x hidden
- Background : `--color-bg` (#0d1526)
- Pas de max-width sur html/body
- Tous les wrappers principaux : width 100%, max-width none, margin 0, padding 0
- Contenu desktop : `max-width: 1280px`, `margin: 0 auto`, `padding: 0 24px`
- Sur mobile : padding 0 16px

---

## 2. TOP HEADER

- Height : 56px, position sticky, top 0, z-index 10
- Background : `--color-bg` (même que la page — pas d'élévation)
- Border-bottom : 1px solid `--color-border`
- Titre "Discussions" : `--color-accent`, 20px, font-weight 700
- Actions droite : icônes + badge utilisateur
- Badge utilisateur (MOMO 0.21 FCFA) : background `--color-surface-2`, border-radius 8px, padding 6px 12px, font-size 13px, color `--color-text-1`
- Pas de box-shadow sur le header

---

## 3. GRILLE DE CATÉGORIES

- Layout : CSS Grid, `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`
- Gap : 16px
- Padding page : 24px (desktop), 16px (mobile)
- Sur mobile : `grid-template-columns: repeat(2, 1fr)`, gap 12px

### Carte catégorie
- Background : `--color-surface` (#162040)
- Border : 1px solid `--color-border`
- Border-radius : 12px
- Padding : 32px 24px
- Aspect-ratio : pas fixe — hauteur naturelle
- Min-height : 180px
- Hover : background `--color-surface-2`, border-color `--color-border-mid`, transform scale(1.01), transition 150ms ease
- Cursor : pointer

### Contenu carte
- Icône : 32px, color `--color-text-2`, margin-bottom 16px
- Titre catégorie : `--color-accent`, 16px, font-weight 600, margin-bottom 6px
- Sous-titre (N groupes) : `--color-text-3`, 13px, font-weight 400
- Texte centré dans la carte

### Badge PUB
- Position : absolute, top 12px, right 12px
- Background : `--color-pub-bg`
- Color : `--color-pub-text`
- Font-size : 11px, font-weight 600, letter-spacing 0.5px
- Padding : 3px 8px, border-radius 4px
- Pas de border, pas de couleur vive

---

## 4. NAVIGATION / SIDEBAR (si présente)

- Background : `--color-bg`
- Border-right : 1px solid `--color-border`
- Nav item actif : background `--color-accent-dim`, color `--color-accent`, border-left 2px solid `--color-accent`
- Nav item inactif : color `--color-text-2`, hover background `--color-accent-glow`
- Pas de box-shadow sur la sidebar

---

## 5. BOTTOM NAVIGATION (mobile)

- Fixed bottom, height 56px
- Background : `--color-bg`
- Border-top : 1px solid `--color-border`
- Icône active : `--color-accent`
- Icône inactive : `--color-text-3`
- Safe area : padding-bottom env(safe-area-inset-bottom)
- Pas de shadow

---

## 6. TYPOGRAPHIE

- Font principale : system-ui ou `'Inter'` — sobre, lisible en dark
- Titres de page : 20–24px, font-weight 700, color `--color-accent`
- Titres de section : 16px, font-weight 600, color `--color-text-1`
- Titres de carte : 16px, font-weight 600, color `--color-accent`
- Corps : 14px, font-weight 400, color `--color-text-2`, line-height 1.5
- Meta (dates, compteurs) : 13px, color `--color-text-3`
- Jamais de text-shadow

---

## 7. BOUTONS

- **Primaire** : background `--color-accent`, color #0d1526 (texte sombre sur bleu clair), height 40px, border-radius 8px, font-weight 600, padding 0 20px
- **Secondaire** : background `--color-surface-2`, color `--color-text-1`, border 1px solid `--color-border-mid`, height 40px, border-radius 8px
- **Ghost** : background none, border none, color `--color-accent`, padding 0
- **Destructif** : background `--color-error-bg`, color `--color-error`, border 1px solid rgba(248,113,113,0.3)
- Border-radius : 8px sur tous les boutons — jamais pill, jamais 0
- Hover : opacity 0.85 ou darken 8%
- Touch target mobile : min 44px height

---

## 8. INPUTS / FORMULAIRES

- Background : `--color-surface-2`
- Border : 1px solid `--color-border-mid`
- Border-radius : 8px
- Height : 44px (inputs), auto (textarea)
- Color : `--color-text-1`
- Placeholder : `--color-text-3`
- Focus : border-color `--color-accent`, box-shadow 0 0 0 3px `--color-accent-dim`
- Outline : none — retirer le outline navigateur
- Label : 13px, font-weight 500, color `--color-text-2`, margin-bottom 6px

---

## 9. BADGES / TAGS

- Base : padding 2px 10px, border-radius 4px, font-size 12px, font-weight 600
- **Actif/accent** : background `--color-accent-dim`, color `--color-accent`
- **Succès** : background `--color-success-bg`, color `--color-success`
- **Erreur** : background `--color-error-bg`, color `--color-error`
- **Neutre** : background `--color-surface-2`, color `--color-text-2`
- **PUB** : voir règle #3

---

## 10. SÉPARATEURS

- Entre sections : border-bottom 1px solid `--color-border`
- Entre items de liste : border-bottom 1px solid `--color-border`
- Jamais de margin seul pour séparer — toujours un 1px border visible
- Pas de bandes colorées comme séparateurs

---

## 11. MODALS / BOTTOM SHEETS

- Overlay : rgba(0,0,0,0.7)
- Modal desktop : background `--color-surface-3`, border-radius 12px, border 1px solid `--color-border-mid`
- Bottom sheet mobile : background `--color-surface-3`, border-radius 16px 16px 0 0
- Handle : 4px × 32px, `--color-border-strong`, centré, margin 12px auto
- Padding contenu : 20px

---

## 12. ÉTATS VIDES

- Pas de card/container — flotte sur le fond de page
- Icône : 32px, color `--color-text-3`
- Titre : 15px, color `--color-text-1`
- Sous-titre : 13px, color `--color-text-3`
- Tout centré, padding 48px 32px

---

## 13. CARTES DE DISCUSSION / POSTS (forums)

- Background : `--color-surface`
- Border : 1px solid `--color-border`
- Border-radius : 8px
- Padding : 16px
- Hover : border-color `--color-border-mid`
- Pas de box-shadow
- Séparateur entre items : border-bottom 1px solid `--color-border`

---

## 14. RESPONSIVE MOBILE (< 768px)

- Grille catégories : 2 colonnes, gap 12px
- Carte catégorie : min-height 140px, padding 20px 16px
- Header : height 52px, titre 18px
- Padding page : 0 16px
- Bottom nav fixe (voir règle #5)
- Boutons CTA : width 100% sur mobile

---

## INTERDICTIONS

- ❌ Pas de fond clair (light mode) — dark blue uniquement
- ❌ Pas d'orange ou de vert comme accent — bleu clair uniquement
- ❌ Pas de box-shadow sur les éléments de liste/feed
- ❌ Pas de border-radius > 12px sur les cartes
- ❌ Pas de pill buttons (border-radius > 8px)
- ❌ Pas de gradient sur les fonds principaux
- ❌ Pas de couleur vive sur le badge PUB
- ❌ Pas de text-shadow
