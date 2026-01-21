-- Modifier le trigger pour ne plus insérer automatiquement le rôle player
-- Le rôle sera géré exclusivement par la fonction create-member

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  -- Ne plus insérer de rôle ici - sera géré par create-member
  -- Cela évite les doublons de rôles
  
  RETURN NEW;
END;
$$;