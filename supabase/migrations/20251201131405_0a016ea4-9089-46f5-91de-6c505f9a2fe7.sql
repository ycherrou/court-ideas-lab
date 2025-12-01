-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Players can create reservations if no active reservation" ON public.reservations;

-- Create updated INSERT policy with proper active reservation check
CREATE POLICY "Players can create reservations if no active reservation" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  -- Admins can always create reservations
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  -- User must be player1 and either:
  (
    auth.uid() = player1_id 
    AND (
      -- Coaches and super_coaches can always create reservations
      public.has_role(auth.uid(), 'coach'::app_role)
      OR public.has_role(auth.uid(), 'super_coach'::app_role)
      OR
      -- Regular players can create if they don't have an active future reservation
      (
        NOT public.has_role(auth.uid(), 'coach'::app_role)
        AND NOT public.has_role(auth.uid(), 'super_coach'::app_role)
        AND NOT EXISTS (
          SELECT 1 
          FROM reservations r 
          WHERE (r.player1_id = auth.uid() OR r.player2_id = auth.uid())
          AND (
            r.date > CURRENT_DATE 
            OR (r.date = CURRENT_DATE AND r.start_time > CURRENT_TIME)
          )
        )
      )
    )
  )
);