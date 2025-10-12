-- Fix the null token issue for existing users
UPDATE auth.users 
SET 
  confirmation_token = NULL,
  recovery_token = NULL,
  email_change_token_new = NULL,
  email_change = NULL
WHERE confirmation_token = '' 
   OR recovery_token = '' 
   OR email_change_token_new = '' 
   OR email_change = '';

-- Create identities for the users if they don't exist
-- provider_id should be the user's id for email provider
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);