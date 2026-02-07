

## Corriger la restriction de date J+1 pour les reservations avec un entraineur

### Probleme identifie
Dans `BookingModal.tsx` (lignes 326-341), la fonction `checkPlayerDateRestriction` est appelee pour les deux joueurs. Quand le partenaire (player2) est un coach, cette verification bloque la reservation avec l'erreur "Les reservations avec un coach ne sont possibles que pour aujourd'hui ou demain".

Cette logique est incorrecte : la restriction J+1 devrait s'appliquer uniquement quand le coach lui-meme fait la reservation, pas quand un joueur reserve une session avec un coach.

### Solution
Modifier la logique pour que la restriction de date du partenaire (player2) ne s'applique pas s'il est entraineur.

### Modification a apporter

**Fichier** : `src/components/BookingModal.tsx`

**Lignes 322-341** - Ajouter une verification du role du partenaire avant d'appliquer sa restriction de date :

```text
Avant :
  const [player1DateCheck, player2DateCheck] = await Promise.all([
    checkPlayerDateRestriction(player1Id),
    checkPlayerDateRestriction(player2Id),
  ]);

  if (!player1DateCheck.ok) { ... }
  if (!player2DateCheck.ok) { ... }

Apres :
  // Verifier si le partenaire est un entraineur
  const [player2IsCoach, player2IsSuperCoach] = await Promise.all([
    isCoach(player2Id),
    isSuperCoach(player2Id),
  ]);
  const partnerIsInstructor = player2IsCoach || player2IsSuperCoach;

  // Toujours verifier la restriction du joueur 1 (celui qui reserve)
  const player1DateCheck = await checkPlayerDateRestriction(player1Id);
  if (!player1DateCheck.ok) {
    toast.error(player1DateCheck.message);
    setLoading(false);
    return;
  }

  // Ne pas appliquer la restriction de date si le partenaire est un entraineur
  // (le joueur peut reserver avec un coach pour n'importe quelle date)
  if (!partnerIsInstructor) {
    const player2DateCheck = await checkPlayerDateRestriction(player2Id);
    if (!player2DateCheck.ok) {
      toast.error(player2DateCheck.message);
      setLoading(false);
      return;
    }
  }
```

### Logique metier clarifiee

| Qui reserve | Avec qui | Restriction de date appliquee |
|-------------|----------|-------------------------------|
| Joueur | Joueur | Aucune (joueurs sans restriction) |
| Joueur | Coach | Aucune (on ignore la restriction J+1 du coach) |
| Joueur | Super Coach | Aucune (super coach sans restriction) |
| Coach | Joueur | J+1 (restriction du coach qui reserve) |
| Coach | Coach | J+1 (restriction du coach qui reserve) |
| Super Coach | Joueur | Aucune |
| Elite | Joueur | J+2 |
| Elite | Coach | J+2 (restriction Elite s'applique toujours) |

### Rappel des regles completes par role

| Role | Terrains | Limite reservations | Horizon de date |
|------|----------|---------------------|-----------------|
| Joueur | Tous | 1 active (bypass si avec entraineur) | Illimite |
| Elite | Tous | 2h/jour max | J+2 |
| Coach | 5, 6, 7, 8, 9, Central | 2 actives | J+1 |
| Super Coach | Tous | 4 actives | Illimite |
| Admin | Tous | Illimite | Illimite |

### Impact
- Un joueur pourra reserver avec un coach pour n'importe quelle date future
- Le coach qui fait lui-meme une reservation reste limite a J+1
- Les autres restrictions (limites de reservations, terrains) restent inchangees

