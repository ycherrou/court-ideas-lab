CREATE OR REPLACE FUNCTION public.validate_coach_date_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  player1_is_coach_only BOOLEAN;
  player2_is_coach_only BOOLEAN;
  player1_is_super_coach BOOLEAN;
  player2_is_super_coach BOOLEAN;
  max_allowed_date DATE;
BEGIN
  max_allowed_date := CURRENT_DATE + INTERVAL '1 day';
  
  -- Verifier si player1 est un coach (pas super_coach)
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player1_id 
    AND role = 'coach'
  ) INTO player1_is_coach_only;
  
  -- Verifier si player1 est un super_coach
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player1_id 
    AND role = 'super_coach'
  ) INTO player1_is_super_coach;
  
  -- Verifier si player2 est un coach (pas super_coach)
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player2_id 
    AND role = 'coach'
  ) INTO player2_is_coach_only;
  
  -- Verifier si player2 est un super_coach
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player2_id 
    AND role = 'super_coach'
  ) INTO player2_is_super_coach;
  
  -- Appliquer la restriction seulement si un joueur est COACH (pas super_coach)
  -- ET que le partenaire n'est pas un entraineur (bypass symetrique)
  -- Coach seul sans entraineur en face = restriction J+1
  IF NEW.date > max_allowed_date THEN
    -- Si player1 est coach simple (pas super) et player2 n'est pas entraineur
    IF player1_is_coach_only AND NOT player1_is_super_coach 
       AND NOT player2_is_coach_only AND NOT player2_is_super_coach THEN
      RAISE EXCEPTION 'Les reservations avec un coach ne sont possibles que pour aujourd''hui ou demain';
    END IF;
    
    -- Si player2 est coach simple (pas super) et player1 n'est pas entraineur
    IF player2_is_coach_only AND NOT player2_is_super_coach 
       AND NOT player1_is_coach_only AND NOT player1_is_super_coach THEN
      RAISE EXCEPTION 'Les reservations avec un coach ne sont possibles que pour aujourd''hui ou demain';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;