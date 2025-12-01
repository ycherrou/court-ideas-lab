-- Supprimer l'ancienne politique restrictive
DROP POLICY IF EXISTS "Players can create reservations if no active reservation" ON reservations;

-- Créer une nouvelle politique plus simple et fonctionnelle
CREATE POLICY "Users can create reservations with rules"
ON reservations
FOR INSERT
WITH CHECK (
  -- Les admins peuvent toujours créer des réservations
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Les coachs et super_coachs peuvent toujours créer des réservations
  (
    (auth.uid() = player1_id OR auth.uid() = player2_id)
    AND
    (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'super_coach'::app_role))
  )
  OR
  -- Les joueurs normaux peuvent créer des réservations s'ils sont l'un des deux joueurs
  -- La vérification de la réservation unique active est faite dans le code
  (
    (auth.uid() = player1_id OR auth.uid() = player2_id)
    AND
    NOT has_role(auth.uid(), 'coach'::app_role)
    AND
    NOT has_role(auth.uid(), 'super_coach'::app_role)
  )
);