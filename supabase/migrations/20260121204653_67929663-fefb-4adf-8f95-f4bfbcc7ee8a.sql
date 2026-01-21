-- Table d'audit pour tracer les actions
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_name text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity_type text NOT NULL CHECK (entity_type IN (
    'RESERVATION', 'MEMBER', 'ROLE', 'BLOCKED_SLOT', 'PASSWORD', 'BULK_IMPORT'
  )),
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  description text
);

-- Index pour les recherches rapides
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);

-- RLS : Seuls les admins peuvent voir les logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Politique d'insertion permissive pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fonction utilitaire pour logger les actions
CREATE OR REPLACE FUNCTION public.log_action(
  _performed_by uuid,
  _performer_name text,
  _action_type text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _old_values jsonb DEFAULT NULL,
  _new_values jsonb DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (
    performed_by, performer_name, action_type,
    entity_type, entity_id, old_values, new_values, description
  ) VALUES (
    _performed_by, _performer_name, _action_type,
    _entity_type, _entity_id, _old_values, _new_values, _description
  );
END;
$$;