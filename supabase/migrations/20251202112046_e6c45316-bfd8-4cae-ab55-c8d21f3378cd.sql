-- Mettre à jour la fonction is_court_allowed_for_user pour inclure le terrain 5
CREATE OR REPLACE FUNCTION public.is_court_allowed_for_user(_user_id uuid, _court_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    CASE
      -- Super coach peut jouer partout
      WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_coach') THEN true
      
      -- Coach normal peut jouer sur 5,6,7,8,9,central
      WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'coach') THEN
        EXISTS (
          SELECT 1 FROM courts 
          WHERE id = _court_id 
          AND (court_number IN (5, 6, 7, 8, 9) OR is_central = true)
        )
      
      -- Tous les autres (admin, player) peuvent jouer partout
      ELSE true
    END
$function$;