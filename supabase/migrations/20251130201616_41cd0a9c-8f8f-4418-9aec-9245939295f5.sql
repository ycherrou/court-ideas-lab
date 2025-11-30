-- Ajouter la colonne full_name
ALTER TABLE profiles ADD COLUMN full_name text;

-- Migrer les données existantes (concaténer first_name et last_name)
UPDATE profiles SET full_name = TRIM(CONCAT(first_name, ' ', last_name));

-- Rendre la colonne obligatoire après migration
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;

-- Supprimer les anciennes colonnes
ALTER TABLE profiles DROP COLUMN first_name;
ALTER TABLE profiles DROP COLUMN last_name;

-- Modifier le trigger handle_new_user pour utiliser full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'player'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;