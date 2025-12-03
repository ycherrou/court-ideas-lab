-- Drop the restrictive policies that are blocking public access
DROP POLICY IF EXISTS "Everyone can view courts" ON public.courts;
DROP POLICY IF EXISTS "Only admins can manage courts" ON public.courts;

-- Create a PERMISSIVE policy for public SELECT access
CREATE POLICY "Everyone can view courts" 
ON public.courts 
FOR SELECT 
TO public
USING (true);

-- Create separate PERMISSIVE policies for admin management (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert courts" 
ON public.courts 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update courts" 
ON public.courts 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete courts" 
ON public.courts 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));