
-- Create reservation_settings table
CREATE TABLE public.reservation_settings (
  role public.app_role PRIMARY KEY,
  max_active integer,
  max_hours_per_day integer,
  allowed_courts integer[],
  can_create boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;

-- RLS: all authenticated users can read
CREATE POLICY "Authenticated users can view settings"
ON public.reservation_settings
FOR SELECT
TO authenticated
USING (true);

-- RLS: only admins can modify
CREATE POLICY "Admins can update settings"
ON public.reservation_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
ON public.reservation_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings"
ON public.reservation_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert initial data based on current rules
INSERT INTO public.reservation_settings (role, max_active, max_hours_per_day, allowed_courts, can_create) VALUES
  ('player', 1, NULL, NULL, true),
  ('elite', NULL, 2, NULL, true),
  ('coach', 2, NULL, ARRAY[5,6,7,8,9,10], false),
  ('super_coach', 4, NULL, NULL, true),
  ('admin', NULL, NULL, NULL, true);

-- Update is_court_allowed_for_user to read from reservation_settings
CREATE OR REPLACE FUNCTION public.is_court_allowed_for_user(_user_id uuid, _court_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _allowed integer[];
  _court_number integer;
BEGIN
  -- Get highest priority role
  SELECT role INTO _role FROM user_roles WHERE user_id = _user_id
    ORDER BY CASE role
      WHEN 'admin' THEN 1
      WHEN 'super_coach' THEN 2
      WHEN 'coach' THEN 3
      WHEN 'elite' THEN 4
      WHEN 'player' THEN 5
    END
    LIMIT 1;

  IF _role IS NULL THEN
    RETURN true; -- no role = allow (shouldn't happen)
  END IF;

  -- Get allowed_courts for this role
  SELECT allowed_courts INTO _allowed FROM reservation_settings WHERE reservation_settings.role = _role;

  -- NULL means all courts allowed
  IF _allowed IS NULL THEN
    RETURN true;
  END IF;

  -- Get court_number for the given court
  SELECT court_number INTO _court_number FROM courts WHERE id = _court_id;

  -- Check if court is in the allowed list (10 = central)
  IF _court_number IS NOT NULL THEN
    RETURN _court_number = ANY(_allowed);
  END IF;

  -- Check if court is central and 10 is in allowed_courts
  IF EXISTS (SELECT 1 FROM courts WHERE id = _court_id AND is_central = true) AND 10 = ANY(_allowed) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- Update validate_elite_restrictions to read max_hours_per_day from settings
CREATE OR REPLACE FUNCTION public.validate_elite_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _max_hours integer;
  _hours_today integer;
BEGIN
  -- Check player1
  SELECT ur.role INTO _role FROM user_roles ur WHERE ur.user_id = NEW.player1_id
    ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'super_coach' THEN 2 WHEN 'coach' THEN 3 WHEN 'elite' THEN 4 WHEN 'player' THEN 5 END LIMIT 1;
  
  IF _role IS NOT NULL THEN
    SELECT max_hours_per_day INTO _max_hours FROM reservation_settings rs WHERE rs.role = _role;
    IF _max_hours IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0) INTO _hours_today
      FROM reservations
      WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
      AND date = NEW.date;
      
      IF _hours_today >= _max_hours THEN
        RAISE EXCEPTION 'Le joueur 1 a atteint sa limite de % heure(s) pour cette journée', _max_hours;
      END IF;
    END IF;
  END IF;

  -- Check player2
  SELECT ur.role INTO _role FROM user_roles ur WHERE ur.user_id = NEW.player2_id
    ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'super_coach' THEN 2 WHEN 'coach' THEN 3 WHEN 'elite' THEN 4 WHEN 'player' THEN 5 END LIMIT 1;
  
  IF _role IS NOT NULL THEN
    SELECT max_hours_per_day INTO _max_hours FROM reservation_settings rs WHERE rs.role = _role;
    IF _max_hours IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0) INTO _hours_today
      FROM reservations
      WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
      AND date = NEW.date;
      
      IF _hours_today >= _max_hours THEN
        RAISE EXCEPTION 'Le joueur 2 a atteint sa limite de % heure(s) pour cette journée', _max_hours;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
