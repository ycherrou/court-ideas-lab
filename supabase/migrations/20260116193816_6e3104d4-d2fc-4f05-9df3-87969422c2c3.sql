-- Fonction de validation de restriction de date pour les coachs
CREATE OR REPLACE FUNCTION public.validate_coach_date_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player1_is_coach BOOLEAN;
  player2_is_coach BOOLEAN;
  max_allowed_date DATE;
BEGIN
  max_allowed_date := CURRENT_DATE + INTERVAL '1 day';
  
  -- Vérifier si player1 est un coach
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player1_id 
    AND role IN ('coach', 'super_coach')
  ) INTO player1_is_coach;
  
  -- Vérifier si player2 est un coach
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.player2_id 
    AND role IN ('coach', 'super_coach')
  ) INTO player2_is_coach;
  
  -- Si un des joueurs est coach et la date > demain
  IF (player1_is_coach OR player2_is_coach) AND NEW.date > max_allowed_date THEN
    RAISE EXCEPTION 'Les réservations avec un coach ne sont possibles que pour aujourd''hui ou demain';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attacher le trigger à la table reservations
CREATE TRIGGER check_coach_date_restriction
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_coach_date_restriction();