-- Ajouter les colonnes pour le système de login avec username et PIN
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE,
ADD COLUMN temporary_pin text,
ADD COLUMN must_change_password boolean DEFAULT false;

-- Index pour améliorer les performances de recherche par username
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Commentaires pour documentation
COMMENT ON COLUMN public.profiles.username IS 'Login unique généré automatiquement (première lettre prénom + nom)';
COMMENT ON COLUMN public.profiles.temporary_pin IS 'Code PIN temporaire à 4 chiffres pour première connexion';
COMMENT ON COLUMN public.profiles.must_change_password IS 'Indique si l''utilisateur doit changer son mot de passe à la prochaine connexion';