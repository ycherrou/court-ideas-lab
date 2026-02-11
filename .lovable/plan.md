

## Supprimer toutes les restrictions d'horizon de reservation

### Objectif
Rendre l'horizon de reservation illimite pour **tous les profils** (Joueur, Elite, Coach, Super Coach, Admin).

### Modifications necessaires

#### 1. Base de donnees - Desactiver le trigger de restriction Coach (J+1)

Remplacer la fonction `validate_coach_date_restriction` par une version qui ne bloque plus rien :

```sql
CREATE OR REPLACE FUNCTION public.validate_coach_date_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Plus aucune restriction de date pour les coachs
  RETURN NEW;
END;
$function$;
```

#### 2. Base de donnees - Desactiver la restriction Elite (J+2) dans le trigger

Modifier la fonction `validate_elite_restrictions` pour supprimer la verification de date (tout en conservant la limite de 2h par jour pour les Elite) :

```sql
CREATE OR REPLACE FUNCTION public.validate_elite_restrictions()
RETURNS trigger ...
-- Supprimer le bloc qui verifie max_allowed_date
-- Conserver le bloc qui verifie les heures quotidiennes (2h/jour)
```

#### 3. Frontend - BookingModal.tsx

Modifier la fonction `checkPlayerDateRestriction` (lignes 268-297) pour ne plus bloquer sur les dates :
- Supprimer la condition pour `elite` (J+2)
- Supprimer la condition pour `coach` (J+1)
- La fonction retournera toujours `{ ok: true }`

#### 4. Frontend - useCoachRestrictions.tsx (aucune modification)

Ce hook gere les restrictions de **terrains**, pas de dates. Il reste inchange.

### Resume des changements

| Avant | Apres |
|-------|-------|
| Coach : J+1 | Coach : Illimite |
| Elite : J+2 | Elite : Illimite |
| Joueur : Illimite | Joueur : Illimite |
| Super Coach : Illimite | Super Coach : Illimite |
| Admin : Illimite | Admin : Illimite |

**Note** : La limite de 2 heures par jour pour les joueurs Elite est conservee (ce n'est pas un horizon de date mais un quota journalier).

### Fichiers modifies

1. **Migration SQL** : nouvelle migration pour mettre a jour les 2 fonctions de trigger
2. **src/components/BookingModal.tsx** : simplifier `checkPlayerDateRestriction` pour toujours retourner ok

