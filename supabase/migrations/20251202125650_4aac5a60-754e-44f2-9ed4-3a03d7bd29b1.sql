-- Drop the existing policy that exposes all roles publicly
DROP POLICY IF EXISTS "Everyone can view roles" ON public.user_roles;

-- Create a new policy that restricts role visibility
CREATE POLICY "Users can view own roles admins can view all"
ON public.user_roles
FOR SELECT
USING (
  (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
);