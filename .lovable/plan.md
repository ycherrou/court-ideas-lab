

## Ajouter le rôle "Joueur Elite" avec restrictions spécifiques

### Objectif
Créer une nouvelle catégorie de joueurs "Elite" avec les règles suivantes :
- **2 heures maximum par jour** (pas de limite globale de réservations actives)
- **Horizon limité a J, J+1 et J+2** (aujourd'hui, demain et apres-demain)
- Acces a **tous les terrains**

### Comparaison des roles

| Role | Limite reservations | Horizon | Terrains |
|------|---------------------|---------|----------|
| Player | 1 active globalement | Illimite | Tous |
| **Elite** | **2h/jour** | **J, J+1, J+2** | **Tous** |
| Coach | 2 actives | J et J+1 | 5,6,7,8,9,Central |
| Super Coach | 4 actives | J et J+1 | Tous |
| Admin | Illimite | Illimite | Tous |

---

## Plan technique

### Etape 1 : Migration base de donnees

**1.1 Ajouter le role "elite" a l'enum app_role**

```sql
ALTER TYPE app_role ADD VALUE 'elite';
```

**1.2 Creer le trigger de validation Elite**

Ce trigger verifie au niveau de la base de donnees :
- La date est dans l'horizon J/J+1/J+2
- Le joueur n'a pas deja 2 heures de reservation ce jour-la

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
  
  -- Verifier si player1 est elite
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player1_id AND role = 'elite'
  ) INTO player1_is_elite;
  
  -- Verifier si player2 est elite
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player2_id AND role = 'elite'
  ) INTO player2_is_elite;
  
  -- Restriction de date pour les joueurs elite
  IF (player1_is_elite OR player2_is_elite) AND NEW.date > max_allowed_date THEN
    RAISE EXCEPTION 'Les joueurs Elite ne peuvent reserver que jusqu a apres-demain (J+2)';
  END IF;
  
  -- Verifier les heures quotidiennes pour player1 elite
  IF player1_is_elite THEN
    SELECT COALESCE(COUNT(*), 0) INTO player1_hours_today
    FROM reservations
    WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
    AND date = NEW.date;
    
    IF player1_hours_today >= 2 THEN
      RAISE EXCEPTION 'Le joueur Elite a deja atteint sa limite de 2 heures pour cette journee';
    END IF;
  END IF;
  
  -- Verifier les heures quotidiennes pour player2 elite
  IF player2_is_elite THEN
    SELECT COALESCE(COUNT(*), 0) INTO player2_hours_today
    FROM reservations
    WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
    AND date = NEW.date;
    
    IF player2_hours_today >= 2 THEN
      RAISE EXCEPTION 'Le joueur Elite partenaire a deja atteint sa limite de 2 heures pour cette journee';
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

**2.1 Ajouter une fonction pour detecter les joueurs Elite**

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

**2.2 Modifier la fonction checkCoachDateRestriction pour inclure Elite**

Renommer en `checkPlayerDateRestriction` et gerer les horizons differents :
- Coach/Super Coach : J+1 maximum
- Elite : J+2 maximum

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
      return { ok: false, message: "Les joueurs Elite ne peuvent reserver que jusqu a apres-demain" };
    }
  } else {
    // J+1 pour Coach/Super Coach
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    if (selectedDate && selectedDate > tomorrow) {
      return { ok: false, message: "Les reservations avec un coach ne sont possibles que pour aujourd hui ou demain" };
    }
  }
  
  return { ok: true };
};
```

**2.3 Ajouter la validation des heures quotidiennes pour Elite**

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

**2.4 Integrer les validations dans handleConfirm**

Avant la creation de la reservation, verifier :
- La limite quotidienne de 2h pour les joueurs Elite
- L'horizon de date (J+2 pour Elite, J+1 pour Coach)

---

### Etape 3 : Mettre a jour useCoachRestrictions.tsx

Ajouter la detection du role Elite :

```typescript
const [isElite, setIsElite] = useState(false);

// Dans fetchRole()
const eliteRole = roles?.find((r) => r.role === "elite");
setIsElite(!!eliteRole);

return { isCoach, isSuperCoach, isElite, allowedCourtIds, loading };
```

---

### Etape 4 : Mettre a jour PartnerSelector.tsx

**4.1 Charger les roles Elite en plus des coachs**

Modifier la requete pour inclure le role `elite` :

```typescript
const { data: coachRolesData } = await supabase
  .from("user_roles")
  .select("user_id, role")
  .in("role", ["coach", "super_coach", "elite"]);
```

**4.2 Ajouter la verification de date pour Elite (J+2)**

```typescript
const isDateBeyondJ2 = (): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const j2 = new Date(today);
  j2.setDate(j2.getDate() + 2);
  j2.setHours(23, 59, 59, 999);
  return selectedDate > j2;
};
```

**4.3 Afficher un indicateur Elite et gerer les restrictions**

- Afficher un emoji ou badge pour les joueurs Elite (ex: `⚡`)
- Desactiver la selection si date > J+2 pour Elite (avec message explicatif)

---

### Etape 5 : Mettre a jour la page Admin

**5.1 Ajouter "Elite" dans le formulaire d'ajout de membre (lignes 721-727)**

```typescript
<SelectItem value="elite">Elite</SelectItem>
```

**5.2 Ajouter "Elite" dans le formulaire de modification de membre (lignes 903-908)**

```typescript
<SelectItem value="elite">Elite</SelectItem>
```

**5.3 Ajouter l'emoji Elite dans l'affichage du role (lignes 816-825)**

```typescript
{role === 'elite' && ' ⚡'}
```

**5.4 Mettre a jour le typage du role (ligne 343)**

Ajouter `"elite"` au type union :

```typescript
role: newRole as "admin" | "coach" | "player" | "super_coach" | "elite"
```

---

## Resume des fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| **Migration SQL** | Ajouter `elite` a l'enum + trigger validation (J+2, 2h/jour) |
| `src/components/BookingModal.tsx` | Ajouter `isElite()`, `checkPlayerDateRestriction()`, `checkEliteDailyLimit()` |
| `src/hooks/useCoachRestrictions.tsx` | Ajouter detection du role Elite |
| `src/components/PartnerSelector.tsx` | Charger roles Elite, avertissement date J+2 |
| `src/pages/Admin.tsx` | Ajouter option "Elite" dans les selects de role + emoji |
| `src/integrations/supabase/types.ts` | Sera mis a jour automatiquement apres migration |

---

## Points de securite

- **Double validation** : Frontend (UX) + Backend (trigger SQL) pour empecher les contournements
- **Coherence avec l'existant** : Meme logique que les restrictions Coach/Super Coach
- **Audit** : Les reservations Elite seront loggees comme les autres

