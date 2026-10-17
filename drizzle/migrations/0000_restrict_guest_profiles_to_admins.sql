CREATE OR REPLACE FUNCTION public.is_guest_profile(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND (
    upper(full_name) LIKE 'PASSAGER%' OR upper(full_name) LIKE 'INVITE%' OR upper(full_name) LIKE 'INVITÉ%'
    OR lower(coalesce(username,'')) LIKE 'passager%' OR lower(coalesce(username,'')) LIKE 'invite%'))
$$;

CREATE OR REPLACE FUNCTION public.validate_guest_profiles_admin_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (public.is_guest_profile(NEW.player1_id) OR public.is_guest_profile(NEW.player2_id))
     AND NOT public.has_role(COALESCE(auth.uid(), NEW.created_by), 'admin') THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent réserver avec un profil Passager ou Invité';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_guest_profiles_admin_only
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_guest_profiles_admin_only();