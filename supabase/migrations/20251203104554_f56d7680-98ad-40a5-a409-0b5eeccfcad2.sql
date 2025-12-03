-- Fix profiles RLS policy for public read access
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;

CREATE POLICY "Everyone can view profiles" 
ON public.profiles 
FOR SELECT 
TO public
USING (true);