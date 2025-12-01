-- Simplify reservations INSERT policy
DROP POLICY IF EXISTS "Users can create reservations with rules" ON public.reservations;

CREATE POLICY "Authenticated users can create reservations" ON public.reservations
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = player1_id
  OR auth.uid() = player2_id
);
