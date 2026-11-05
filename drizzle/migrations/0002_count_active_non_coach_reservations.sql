CREATE OR REPLACE FUNCTION public.count_active_free_reservations(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.reservations r
  WHERE (r.player1_id = _user_id OR r.player2_id = _user_id)
    AND (r.date > (now() AT TIME ZONE 'Africa/Casablanca')::date
         OR (r.date = (now() AT TIME ZONE 'Africa/Casablanca')::date
             AND r.start_time > (now() AT TIME ZONE 'Africa/Casablanca')::time))
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = CASE WHEN r.player1_id = _user_id THEN r.player2_id ELSE r.player1_id END
        AND ur.role IN ('coach','super_coach')
    )
$$;
GRANT EXECUTE ON FUNCTION public.count_active_free_reservations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_instructor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('coach','super_coach'))
$$;
GRANT EXECUTE ON FUNCTION public.is_instructor(uuid) TO authenticated;