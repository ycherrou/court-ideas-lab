-- audit_logs: no direct inserts; logging goes through log_action / triggers (security definer)
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- reservations: only signed-in users can read
DROP POLICY IF EXISTS "Everyone can view reservations" ON public.reservations;
CREATE POLICY "Authenticated users can view reservations" ON public.reservations
  FOR SELECT TO authenticated USING (true);

-- profiles: signed-in only, and sensitive columns hidden from the API
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, username, created_at, must_change_password) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Admin-only full profile list (email, temporary PIN)
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- Public TV display: minimal reservation info for one day
CREATE OR REPLACE FUNCTION public.get_public_reservations(_date date)
RETURNS TABLE(id uuid, court_id uuid, start_time time, end_time time, player1_name text, player2_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.court_id, r.start_time, r.end_time, p1.full_name, p2.full_name
  FROM public.reservations r
  LEFT JOIN public.profiles p1 ON p1.id = r.player1_id
  LEFT JOIN public.profiles p2 ON p2.id = r.player2_id
  WHERE r.date = _date;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(date) TO anon, authenticated;