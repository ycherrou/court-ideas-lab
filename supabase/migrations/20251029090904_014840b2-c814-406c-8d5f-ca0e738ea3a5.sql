-- 1. Ajouter les nouveaux rôles à l'enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_coach';