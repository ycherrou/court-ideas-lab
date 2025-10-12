-- Ensure identities for email provider use email as provider_id
UPDATE auth.identities i
SET provider_id = u.email
FROM auth.users u
WHERE i.user_id = u.id AND i.provider = 'email' AND i.provider_id <> u.email;