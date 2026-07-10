## Situation

Je n'ai touché à aucun fichier. La panne de connexion venait du backend : PostgREST renvoyait `PGRST002` ("Could not query the database for the schema cache"), donc la fonction `login-with-username` ne trouvait plus aucun profil et répondait "Identifiants invalides".

J'ai déclenché un redémarrage du backend Lovable Cloud. Aucun code applicatif n'a été modifié.

## Étape 1 — Vérification (toi)

1. Attends 1–2 minutes que le backend finisse de redémarrer.
2. Recharge la page `/auth` (Ctrl+Shift+R).
3. Retente la connexion `admin` + code PIN.

Si ça fonctionne, il n'y a rien d'autre à faire.

## Étape 2 — Si le problème persiste après redémarrage

Dans ce cas, on renforce la fonction edge `login-with-username` pour qu'elle ne renvoie plus "Identifiants invalides" quand la vraie cause est une erreur backend :

- Détecter les codes d'erreur PostgREST/infrastructure (`PGRST002`, timeouts, erreurs réseau) séparément de "profil introuvable".
- Renvoyer un message explicite comme "Service temporairement indisponible, réessayez dans quelques instants" avec un statut 503.
- Ajouter une petite logique de retry (2 tentatives espacées de 500 ms) sur la lecture du profil pour absorber les cache-miss transitoires.

Aucune modification de base de données, aucun changement d'UI, aucun impact sur les autres écrans.

## Fichier concerné (étape 2 uniquement)

- `supabase/functions/login-with-username/index.ts`

Dis-moi simplement si la connexion remarche après le redémarrage, ou si tu veux qu'on passe directement à l'étape 2.