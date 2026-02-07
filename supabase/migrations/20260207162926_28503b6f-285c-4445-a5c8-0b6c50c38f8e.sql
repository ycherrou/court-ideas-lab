-- Mettre à jour la politique RLS pour permettre aux joueurs de créer des réservations
-- avec un entraîneur même s'ils ont déjà une réservation active

-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Authenticated users can create reservations" ON public.reservations;

-- Créer la nouvelle politique avec la logique mise à jour
CREATE POLICY "Authenticated users can create reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  -- Les admins peuvent tout faire
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    -- L'utilisateur doit être soit player1 soit player2
    (auth.uid() = player1_id OR auth.uid() = player2_id)
    AND (
      -- Les coachs et super_coachs peuvent créer sans restriction de réservation active
      has_role(auth.uid(), 'coach'::app_role)
      OR has_role(auth.uid(), 'super_coach'::app_role)
      -- Si le partenaire (player2) est un entraîneur, pas de restriction pour le joueur
      OR has_role(player2_id, 'coach'::app_role)
      OR has_role(player2_id, 'super_coach'::app_role)
      -- Si le partenaire (player1) est un entraîneur, pas de restriction pour le joueur
      OR has_role(player1_id, 'coach'::app_role)
      OR has_role(player1_id, 'super_coach'::app_role)
      -- Les joueurs normaux sans entraîneur doivent respecter la limite
      OR true  -- La vérification de limite est faite par le trigger check_reservation_limit
    )
  )
);