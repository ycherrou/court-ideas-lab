
-- 1. Supprimer la restriction de date Coach (J+1)
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

-- 2. Supprimer la restriction de date Elite (J+2) tout en conservant le quota 2h/jour
CREATE OR REPLACE FUNCTION public.validate_elite_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  player1_is_elite BOOLEAN;
  player2_is_elite BOOLEAN;
  player1_hours_today INTEGER;
  player2_hours_today INTEGER;
BEGIN
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
$function$;
