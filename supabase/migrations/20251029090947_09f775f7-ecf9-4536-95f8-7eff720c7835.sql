-- 2. Modifier la RLS policy sur reservations pour exclure les coachs de la vérification de réservation unique
DROP POLICY IF EXISTS "Players can create reservations if no active reservation" ON public.reservations;

CREATE POLICY "Players can create reservations if no active reservation" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  -- Les admins peuvent toujours créer
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  -- Les players/coachs peuvent créer si c'est eux player1
  -- Mais seuls les non-coachs ont la restriction de réservation unique
  (
    auth.uid() = player1_id 
    AND (
      -- Les coachs et super_coachs peuvent créer sans restriction
      has_role(auth.uid(), 'coach'::app_role)
      OR has_role(auth.uid(), 'super_coach'::app_role)
      OR (
        -- Les players normaux doivent ne pas avoir de réservation active
        NOT has_role(auth.uid(), 'coach'::app_role)
        AND NOT has_role(auth.uid(), 'super_coach'::app_role)
        AND NOT EXISTS (
          SELECT 1
          FROM reservations r
          WHERE ((r.player1_id = auth.uid()) OR (r.player2_id = auth.uid()))
            AND ((r.date > CURRENT_DATE) OR ((r.date = CURRENT_DATE) AND ((r.start_time)::time with time zone > CURRENT_TIME)))
        )
      )
    )
  )
);

-- 3. Fonction pour vérifier si un terrain est autorisé pour un utilisateur
CREATE OR REPLACE FUNCTION public.is_court_allowed_for_user(_user_id uuid, _court_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- Super coach peut jouer partout
      WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_coach') THEN true
      
      -- Coach normal peut jouer sur 6,7,8,9,central
      WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'coach') THEN
        EXISTS (
          SELECT 1 FROM courts 
          WHERE id = _court_id 
          AND (court_number IN (6, 7, 8, 9) OR is_central = true)
        )
      
      -- Tous les autres (admin, player) peuvent jouer partout
      ELSE true
    END
$$;

-- 4. Trigger pour valider les terrains avant insertion
CREATE OR REPLACE FUNCTION public.validate_coach_court_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier player1
  IF NOT public.is_court_allowed_for_user(NEW.player1_id, NEW.court_id) THEN
    RAISE EXCEPTION 'Le joueur 1 n''est pas autorisé sur ce terrain';
  END IF;
  
  -- Vérifier player2
  IF NOT public.is_court_allowed_for_user(NEW.player2_id, NEW.court_id) THEN
    RAISE EXCEPTION 'Le joueur 2 n''est pas autorisé sur ce terrain';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_coach_court ON public.reservations;
CREATE TRIGGER validate_coach_court
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_coach_court_restriction();

-- 5. Modifier le trigger handle_new_user pour ne pas assigner automatiquement 'player' si un rôle existe déjà
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  
  -- Assigner le rôle 'player' seulement si aucun rôle n'existe déjà
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'player'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;