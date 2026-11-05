CREATE OR REPLACE FUNCTION public.log_reservation_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _performer text;
  _p1 text; _p2 text; _court text;
BEGIN
  SELECT full_name INTO _performer FROM profiles WHERE id = _uid;
  SELECT full_name INTO _p1 FROM profiles WHERE id = OLD.player1_id;
  SELECT full_name INTO _p2 FROM profiles WHERE id = OLD.player2_id;
  SELECT name INTO _court FROM courts WHERE id = OLD.court_id;
  INSERT INTO audit_logs (performed_by, performer_name, action_type, entity_type, entity_id, old_values, new_values, description)
  VALUES (_uid, COALESCE(_performer, 'Système'), 'DELETE', 'RESERVATION', OLD.id,
    jsonb_build_object('date', OLD.date, 'court', _court, 'start_time', OLD.start_time, 'end_time', OLD.end_time, 'player1', _p1, 'player2', _p2),
    NULL,
    'Annulation réservation: ' || COALESCE(_p1,'?') || ' avec ' || COALESCE(_p2,'?') || ' le ' || OLD.date || ' (' || COALESCE(_court,'?') || ' ' || to_char(OLD.start_time,'HH24:MI') || ')');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reservation_delete ON public.reservations;
CREATE TRIGGER trg_log_reservation_delete
AFTER DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.log_reservation_delete();