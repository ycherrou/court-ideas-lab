## Ajouter l'historique des blocages de terrains

### Contexte
Les actions de blocage (création/suppression) sont déjà tracées dans la table `audit_logs` avec `entity_type = 'BLOCKED_SLOT'`. Il suffit d'exposer cet historique dans l'interface admin, dédié aux blocages, en plus du journal global déjà disponible dans l'onglet "Historique".

### Modifications

#### 1. Nouveau composant `src/components/BlockedSlotsHistory.tsx`

Un composant léger qui affiche l'historique des blocages :
- Charge les `audit_logs` filtrés sur `entity_type = 'BLOCKED_SLOT'`
- Pagination (20 par page)
- Filtres : type d'action (Création / Suppression / Tous), recherche par nom d'auteur, plage de dates
- Tableau avec colonnes : Date/heure, Auteur, Action (badge coloré Création/Suppression), Description (ex: "Création blocage: Court 3 le 2026-04-25"), Détails (bouton qui ouvre un dialog avec `old_values`/`new_values` formatés : terrain, date, horaire, raison)
- Bouton "Rafraîchir" et bouton "Exporter CSV"

#### 2. Modification de `src/pages/Admin.tsx` - onglet Blocages

Restructurer l'onglet "Blocages" en sous-sections (cards empilées) :
1. Formulaire "Nouveau blocage" (existant, inchangé)
2. Tableau "Créneaux bloqués actifs" (existant, inchangé)
3. **Nouveau** : Card "Historique des blocages" qui rend `<BlockedSlotsHistory />`

Aucun changement sur le formulaire ou la liste active.

#### 3. Aucune modification de la base de données

L'audit existant suffit. Les actions `CREATE` et `DELETE` sur `BLOCKED_SLOT` sont déjà loggées dans `Admin.tsx` (lignes 582-591 pour la création, 237-243 pour la suppression).

### Fichiers concernés
- `src/components/BlockedSlotsHistory.tsx` (nouveau)
- `src/pages/Admin.tsx` (ajout d'une card dans l'onglet Blocages)

### Avantages
- Historique dédié et accessible directement depuis l'onglet Blocages, sans naviguer vers l'onglet Historique global
- Réutilise l'infrastructure d'audit existante (aucune migration SQL)
- Filtres et export CSV adaptés au contexte des blocages
