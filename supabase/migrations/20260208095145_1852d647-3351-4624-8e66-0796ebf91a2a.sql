-- Créer une fonction de validation pour empêcher les admins dans les réservations
CREATE OR REPLACE FUNCTION public.validate_no_admin_in_reservation()
RETURNS TRIGGER AS $$
BEGIN
  IF public.has_role(NEW.player1_id, 'admin') OR public.has_role(NEW.player2_id, 'admin') THEN
    RAISE EXCEPTION 'Les administrateurs ne peuvent pas participer aux reservations';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger sur la table reservations
CREATE TRIGGER check_no_admin_in_reservation
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_no_admin_in_reservation();