-- Fix reservations RLS policies
DROP POLICY IF EXISTS "Everyone can view reservations" ON public.reservations;

CREATE POLICY "Everyone can view reservations" 
ON public.reservations 
FOR SELECT 
TO public
USING (true);

-- Fix blocked_slots RLS policies
DROP POLICY IF EXISTS "Everyone can view blocked slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "Only admins can manage blocked slots" ON public.blocked_slots;

CREATE POLICY "Everyone can view blocked slots" 
ON public.blocked_slots 
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Admins can insert blocked slots" 
ON public.blocked_slots 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update blocked slots" 
ON public.blocked_slots 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blocked slots" 
ON public.blocked_slots 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));