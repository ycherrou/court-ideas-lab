## Diagnostic actuel

Les vérifications indiquent que le backend Lovable Cloud est actuellement disponible :

- Backend : répond normalement.
- Base de données : en ligne.
- Connexions : faibles, pas de saturation visible.
- Build du site : OK.

Les logs montrent toutefois deux signaux récents :

1. La fonction de connexion `login-with-username` a encore rencontré une erreur temporaire `PGRST002` vers 15:09, liée au cache de schéma du backend.
2. Le navigateur a aussi une erreur `Invalid Refresh Token`, généralement causée par une ancienne session stockée localement.

## Plan de résolution

### Étape 1 — Vérification côté utilisateur

1. Ouvrir la page `/auth`.
2. Vider l'ancienne session du navigateur :
   - soit en navigation privée,
   - soit en supprimant le stockage local du site,
   - soit en faisant une déconnexion/rechargement forcé si l'écran le permet.
3. Réessayer la connexion avec le compte admin.

### Étape 2 — Si la connexion échoue encore

Je vérifierai précisément la fonction de login et les derniers logs au moment de l'échec pour savoir si :

- le backend renvoie encore `PGRST002`,
- le profil `admin` n'est pas trouvé,
- le rôle admin n'est pas chargé,
- ou l'application bloque après connexion.

### Étape 3 — Correction possible selon le résultat

Selon le signal observé :

- Si c'est encore `PGRST002` : redémarrage du backend Lovable Cloud puis vérification.
- Si c'est une session corrompue : améliorer le nettoyage automatique des tokens invalides.
- Si c'est un blocage après login : corriger la logique frontend concernée.
- Si c'est un problème de rôle admin : vérifier et corriger l'entrée dans `user_roles`.

## Ce que je ne change pas pour l'instant

Aucune modification de code ni de base de données tant que le symptôme exact n'est pas confirmé après nettoyage de session/retest.
