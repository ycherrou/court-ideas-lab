-- Set required token columns to empty string to satisfy GoTrue expectations
UPDATE auth.users 
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE email IN (
  'admin@tennis.club',
  'jean.dupont@tennis.club',
  'sophie.martin@tennis.club',
  'pierre.bernard@tennis.club',
  'claire.dubois@tennis.club'
);
