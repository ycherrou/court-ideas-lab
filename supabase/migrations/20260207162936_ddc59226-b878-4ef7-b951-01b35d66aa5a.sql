-- Corriger la politique RLS pour ne pas être trop permissive

-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Authenticated users can create reservations" ON public.reservations;

-- Créer la politique correcte : 
-- - Les admins peuvent créer pour n'importe qui
-- - Les utilisateurs peuvent créer s'ils sont player1 ou player2
-- - La vérification de limite est gérée par le frontend et les triggers
CREATE POLICY "Authenticated users can create reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR auth.uid() = player1_id 
  OR auth.uid() = player2_id
);