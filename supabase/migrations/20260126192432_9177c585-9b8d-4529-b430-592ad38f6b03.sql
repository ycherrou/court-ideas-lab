-- Ajouter la valeur 'elite' à l'enum app_role
ALTER TYPE app_role ADD VALUE 'elite';

-- Créer la fonction de validation Elite
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

-- Créer le trigger
CREATE TRIGGER check_elite_restrictions
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_elite_restrictions();