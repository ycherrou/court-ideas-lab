

## Permettre aux joueurs de reserver avec un entraineur sans restriction de match en cours

### Contexte actuel
Actuellement, un joueur avec une reservation active (match pas encore termine) ne peut pas faire de nouvelle reservation. Cette regle est appliquee a deux niveaux :

1. **Frontend** (`BookingModal.tsx`) : Verification via `countActiveReservations` et `getMaxReservations`
2. **Base de donnees** : Politique RLS `"Players can create reservations if no active reservation"` qui bloque l'insertion

### Modification demandee
Lever cette restriction quand le partenaire choisi est un **coach** ou **super_coach**, permettant au joueur de reserver une session d'entrainement meme s'il a deja un match planifie.

### Solution technique

#### 1. Modifier le Frontend (`src/components/BookingModal.tsx`)

**Verification lors de la selection de date (lignes 218-241)** :
- Ajouter une verification pour savoir si le partenaire selectionne est un entraineur
- Si oui, ne pas bloquer meme si le joueur a atteint sa limite

**Verification finale avant insertion (lignes 440-478)** :
- Modifier la logique de `player1ActiveCount >= player1MaxRes` pour exclure les cas ou le partenaire est un entraineur
- Pour player1 (le joueur qui reserve) : ignorer la limite si player2 est coach/super_coach
- Pour player2 : cette verification ne change pas car les entraineurs ont deja une limite plus elevee

Modifications specifiques :
```text
Ligne 448-458 : Ajouter une condition pour verifier si player2 est coach/super_coach
  - Si oui, ignorer la verification de limite pour player1

Ligne 468-478 : Garder cette verification car elle concerne le partenaire
  - Les coachs ont deja des limites differentes gerees par getMaxReservations
```

#### 2. Modifier la politique RLS (migration SQL)

Mettre a jour la politique `"Players can create reservations if no active reservation"` pour exclure les cas ou l'un des joueurs est un entraineur :

```sql
-- La verification de reservation unique ne s'applique pas si le partenaire est un entraineur
CREATE POLICY "Players can create reservations if no active reservation" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    auth.uid() = player1_id 
    AND (
      -- Les coachs et super_coachs peuvent creer sans restriction
      has_role(auth.uid(), 'coach'::app_role)
      OR has_role(auth.uid(), 'super_coach'::app_role)
      -- Si le partenaire (player2) est un entraineur, pas de restriction
      OR has_role(player2_id, 'coach'::app_role)
      OR has_role(player2_id, 'super_coach'::app_role)
      OR (
        -- Les players normaux doivent ne pas avoir de reservation active
        NOT has_role(auth.uid(), 'coach'::app_role)
        AND NOT has_role(auth.uid(), 'super_coach'::app_role)
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
          WHERE ((r.player1_id = auth.uid()) OR (r.player2_id = auth.uid()))
            AND ((r.date > CURRENT_DATE) OR (r.date = CURRENT_DATE AND r.start_time > CURRENT_TIME))
        )
      )
    )
  )
);
```

### Resume des changements

| Fichier | Modification |
|---------|--------------|
| `src/components/BookingModal.tsx` | Ignorer la limite de reservation pour player1 si player2 est coach/super_coach |
| Migration SQL | Ajouter conditions `has_role(player2_id, 'coach')` et `has_role(player2_id, 'super_coach')` |

### Impact
- Un joueur avec 1 reservation active peut reserver une session avec un entraineur
- La limite de 1 reservation s'applique toujours entre joueurs normaux
- Les entraineurs conservent leurs propres limites (2 pour coach, 4 pour super_coach)

