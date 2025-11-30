-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Recréer la politique avec WITH CHECK pour les insertions
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));