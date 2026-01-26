
## Ajouter le rôle "Joueur Elite" avec restrictions spécifiques

### Objectif
Créer une nouvelle catégorie de joueurs "Elite" avec les règles suivantes :
- **2 heures maximum par jour** (pas de limite globale de réservations actives)
- **Horizon limité à J, J+1 et J+2** (aujourd'hui, demain et après-demain)
- Accès à **tous les terrains**

### Comparaison des rôles

| Rôle | Limite réservations | Horizon | Terrains |
|------|---------------------|---------|----------|
| Player | 1 active globalement | Illimité | Tous |
| **Elite** | **2h/jour** | **J, J+1, J+2** | **Tous** |
| Coach | 2 actives | J et J+1 | 5,6,7,8,9,Central |
| Super Coach | 4 actives | J et J+1 | Tous |
| Admin | Illimité | Illimité | Tous |

---

## Plan technique

### Etape 1 : Modifier la base de données

**1.1 Ajouter le rôle "elite" à l'enum**

```sql
ALTER TYPE app_role ADD VALUE 'elite';
```

**1.2 Créer le trigger de validation Elite**

Ce trigger vérifie :
- La date est dans l'horizon J/J+1/J+2
- Le joueur n'a pas déjà 2 heures de réservation ce jour-là

```sql
CREATE OR REPLACE FUNCTION public.validate_elite_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player1_is_elite BOOLEAN;
  player2_is_elite BOOLEAN;
  max_allowed_date DATE;
  player1_hours_today INTEGER;
  player2_hours_today INTEGER;
BEGIN
  -- J+2 pour les Elite
  max_allowed_date := CURRENT_DATE + INTERVAL '2 days';
  
  -- Vérifier si player1 est elite
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player1_id AND role = 'elite'
  ) INTO player1_is_elite;
  
  -- Vérifier si player2 est elite
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player2_id AND role = 'elite'
  ) INTO player2_is_elite;
  
  -- Restriction de date pour les joueurs elite
  IF (player1_is_elite OR player2_is_elite) AND NEW.date > max_allowed_date THEN
    RAISE EXCEPTION 'Les joueurs Elite ne peuvent réserver que jusqu''à après-demain (J+2)';
  END IF;
  
  -- Vérifier les heures quotidiennes pour player1 elite
  IF player1_is_elite THEN
    SELECT COALESCE(COUNT(*), 0) INTO player1_hours_today
    FROM reservations
    WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
    AND date = NEW.date;
    
    IF player1_hours_today >= 2 THEN
      RAISE EXCEPTION 'Le joueur Elite a déjà atteint sa limite de 2 heures pour cette journée';
    END IF;
  END IF;
  
  -- Vérifier les heures quotidiennes pour player2 elite
  IF player2_is_elite THEN
    SELECT COALESCE(COUNT(*), 0) INTO player2_hours_today
    FROM reservations
    WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
    AND date = NEW.date;
    
    IF player2_hours_today >= 2 THEN
      RAISE EXCEPTION 'Le joueur Elite partenaire a déjà atteint sa limite de 2 heures pour cette journée';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_elite_restrictions
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_elite_restrictions();
```

---

### Etape 2 : Modifier BookingModal.tsx

**2.1 Ajouter la détection du rôle Elite**

```typescript
const isElite = async (playerId: string): Promise<boolean> => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", playerId)
    .eq("role", "elite")
    .maybeSingle();
  return !!data;
};
```

**2.2 Ajouter la validation de date pour Elite (J+2)**

Modifier `checkCoachDateRestriction` pour gérer Elite avec un horizon différent :

```typescript
const checkPlayerDateRestriction = async (playerId: string): Promise<{ ok: boolean; message?: string }> => {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", playerId)
    .in("role", ["coach", "super_coach", "elite"]);

  const role = roles?.[0]?.role;
  if (!role) return { ok: true };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (role === "elite") {
    // J+2 pour Elite
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 2);
    maxDate.setHours(23, 59, 59, 999);
    
    if (selectedDate && selectedDate > maxDate) {
      return { ok: false, message: "Les joueurs Elite ne peuvent réserver que jusqu'à après-demain" };
    }
  } else {
    // J+1 pour Coach/Super Coach
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    if (selectedDate && selectedDate > tomorrow) {
      return { ok: false, message: "Les réservations avec un coach ne sont possibles que pour aujourd'hui ou demain" };
    }
  }
  
  return { ok: true };
};
```

**2.3 Ajouter la validation des heures quotidiennes**

```typescript
const checkEliteDailyLimit = async (playerId: string, dateStr: string): Promise<boolean> => {
  const isElitePlayer = await isElite(playerId);
  if (!isElitePlayer) return true;

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id")
    .eq("date", dateStr)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

  return (reservations?.length || 0) < 2;
};
```

**2.4 Intégrer les validations dans handleConfirm**

Avant la création de la réservation, vérifier :
- La limite quotidienne de 2h pour les joueurs Elite
- L'horizon de date (J+2 pour Elite, J+1 pour Coach)

---

### Etape 3 : Mettre à jour useCoachRestrictions.tsx

Ajouter la détection du rôle Elite :

```typescript
const [isElite, setIsElite] = useState(false);

// Dans fetchRole()
const eliteRole = roles?.find((r) => r.role === "elite");
setIsElite(!!eliteRole);

return { isCoach, isSuperCoach, isElite, allowedCourtIds, loading };
```

---

### Etape 4 : Mettre à jour PartnerSelector.tsx

Ajouter un avertissement quand un joueur Elite est sélectionné pour une date au-delà de J+2.

---

### Etape 5 : Mettre à jour la page Admin

Ajouter "elite" comme option de rôle dans la gestion des membres.

---

## Résumé des modifications

| Fichier | Modification |
|---------|--------------|
| **Migration SQL** | Ajouter `elite` à l'enum + trigger validation (J+2, 2h/jour) |
| `src/components/BookingModal.tsx` | Validations Elite (date J+2 + heures/jour) |
| `src/hooks/useCoachRestrictions.tsx` | Détection du rôle Elite |
| `src/components/PartnerSelector.tsx` | Avertissement date pour Elite |
| `src/pages/Admin.tsx` | Option de rôle Elite |
