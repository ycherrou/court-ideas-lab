

## Ajouter une page de configuration des regles de reservation

### Objectif
Permettre a l'administrateur de modifier les regles de reservation (quotas, terrains, restrictions) depuis l'interface, sans intervention technique.

### 1. Nouvelle table `reservation_settings`

Stocker les regles configurables par role dans une table dediee :

```text
reservation_settings
+------------------+----------+---------+
| role             | app_role | PK      |
| max_active       | integer  | nullable|
| max_hours_per_day| integer  | nullable|
| allowed_courts   | text[]   | nullable|
| can_create       | boolean  | default true |
+------------------+----------+---------+
```

- `role` : cle primaire, une ligne par role (player, elite, coach, super_coach, admin)
- `max_active` : nombre max de reservations actives (null = illimite)
- `max_hours_per_day` : limite d'heures par jour (null = illimite, ex: 2 pour elite)
- `allowed_courts` : liste de numeros de terrain autorises (null = tous)
- `can_create` : si le role peut creer des reservations (false pour coach actuellement)

Donnees initiales basees sur les regles actuelles :

| Role | max_active | max_hours_per_day | allowed_courts | can_create |
|------|-----------|-------------------|----------------|------------|
| player | 1 | null | null (tous) | true |
| elite | null | 2 | null (tous) | true |
| coach | 2 | null | {5,6,7,8,9,10} | false |
| super_coach | 4 | null | null (tous) | true |
| admin | null | null | null (tous) | true |

(10 = terrain central, on utilisera les court_number)

### 2. Politiques RLS

- SELECT : accessible a tous les utilisateurs authentifies (les regles doivent etre lisibles pour le frontend)
- UPDATE/INSERT/DELETE : uniquement pour les admins

### 3. Nouvel onglet "Regles" dans la page Admin

Un nouvel onglet dans la page Admin existante avec :
- Un tableau listant les 5 roles avec leurs regles editables
- Pour chaque role, des champs modifiables :
  - Quota de reservations actives (nombre ou "Illimite")
  - Limite d'heures par jour (nombre ou "Illimite")
  - Terrains autorises (selection multiple des terrains)
  - Peut creer des reservations (oui/non)
- Un bouton "Enregistrer" par ligne ou global
- Log d'audit a chaque modification

### 4. Modification du BookingModal

Remplacer les valeurs en dur par une lecture de la table `reservation_settings` :
- `getMaxReservations()` : lire `max_active` depuis la table
- Restrictions de terrains : lire `allowed_courts` depuis la table
- Verification coach `can_create` : lire depuis la table

### 5. Modification des triggers de base de donnees

Mettre a jour les fonctions de trigger pour lire depuis `reservation_settings` :
- `validate_elite_restrictions()` : lire `max_hours_per_day` depuis la table
- `validate_coach_court_restriction()` : lire `allowed_courts` depuis la table
- `is_court_allowed_for_user()` : lire les terrains depuis la table

### 6. Modification du hook `useCoachRestrictions`

Adapter le hook pour lire les restrictions de terrains depuis `reservation_settings` au lieu de les coder en dur.

### Fichiers concernes

1. **Nouvelle migration SQL** : creation de la table, donnees initiales, RLS, mise a jour des triggers
2. **src/pages/Admin.tsx** : ajout de l'onglet "Regles"
3. **src/components/BookingModal.tsx** : lecture des regles depuis la table
4. **src/hooks/useCoachRestrictions.tsx** : lecture des terrains autorises depuis la table
5. **src/hooks/useReservationSettings.tsx** (nouveau) : hook pour charger les regles de reservation

### Avantages

- L'admin peut modifier les quotas et restrictions sans demander de changement technique
- Toutes les regles sont centralisees dans une seule table
- Les triggers de base de donnees lisent aussi cette table, garantissant la coherence
- Chaque modification est tracee dans le journal d'audit

