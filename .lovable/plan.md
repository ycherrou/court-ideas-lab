

## Corriger le bypass de limite de reservation quand un entraineur est implique

### Probleme identifie

Dans `BookingModal.tsx` (lignes 475-493), la verification de limite pour **player2** ne tient pas compte du fait que **player1** pourrait etre un entraineur.

**Code actuel :**
```text
// Lignes 459-462: On verifie si player2 est entraineur pour ignorer la limite de player1
const player2IsCoach = await isCoach(player2Id);
const player2IsSuperCoach = await isSuperCoach(player2Id);
const partnerIsInstructor = player2IsCoach || player2IsSuperCoach;

// Ligne 465: On bypass la limite de player1 si le partenaire est entraineur
if (!partnerIsInstructor && player1ActiveCount >= player1MaxRes) { ... }

// Lignes 485-493: On verifie la limite de player2 SANS verifier si player1 est entraineur!
if (player2ActiveCount >= player2MaxRes) { ... }  // <-- BUG ICI
```

**Scenario qui echoue :**
- Player1 = Dislam (super_coach)
- Player2 = Bennani Younes (joueur avec 1 reservation active)
- Resultat : Erreur "Le joueur 2 a atteint sa limite de 1 reservation(s)"
- Attendu : La limite devrait etre ignoree car player1 est entraineur

### Solution

Ajouter une verification symetrique : si **player1** est un entraineur, on ignore la limite de **player2**.

### Modification a apporter

**Fichier** : `src/components/BookingModal.tsx`

**Lignes 459-493** - Ajouter la verification inverse :

```text
Avant :
  // Verifier si le partenaire est un entraineur (coach ou super_coach)
  const player2IsCoach = await isCoach(player2Id);
  const player2IsSuperCoach = await isSuperCoach(player2Id);
  const partnerIsInstructor = player2IsCoach || player2IsSuperCoach;

  // Si le partenaire est un entraineur, on ignore la limite du joueur 1
  if (!partnerIsInstructor && player1ActiveCount >= player1MaxRes) { ... }

  // Check player 2 reservation limit
  ...
  if (player2ActiveCount >= player2MaxRes) { ... }  // <-- Pas de bypass!

Apres :
  // Verifier si player2 est un entraineur (pour ignorer limite player1)
  const player2IsCoach = await isCoach(player2Id);
  const player2IsSuperCoach = await isSuperCoach(player2Id);
  const player2IsInstructor = player2IsCoach || player2IsSuperCoach;

  // Verifier si player1 est un entraineur (pour ignorer limite player2)
  const player1IsCoach = await isCoach(player1Id);
  const player1IsSuperCoach = await isSuperCoach(player1Id);
  const player1IsInstructor = player1IsCoach || player1IsSuperCoach;

  // Si le partenaire (player2) est un entraineur, on ignore la limite du joueur 1
  if (!player2IsInstructor && player1ActiveCount >= player1MaxRes) { ... }

  // Check player 2 reservation limit
  ...
  // Si player1 est un entraineur, on ignore la limite du joueur 2
  if (!player1IsInstructor && player2ActiveCount >= player2MaxRes) { ... }
```

### Logique metier clarifiee

| Situation | Player 1 | Player 2 | Limite appliquee |
|-----------|----------|----------|------------------|
| Joueur avec joueur | joueur | joueur | Limite des 2 joueurs |
| Joueur avec coach | joueur | coach | Aucune limite (bypass pour joueur) |
| Coach avec joueur | coach | joueur | Aucune limite (bypass pour joueur) |
| Joueur avec super_coach | joueur | super_coach | Aucune limite (bypass pour joueur) |
| Super_coach avec joueur | super_coach | joueur | Aucune limite (bypass pour joueur) |
| Coach avec coach | coach | coach | Limites des 2 coachs (2 chacun) |

### Resume

- Si un des deux joueurs est entraineur (coach ou super_coach), la limite de l'autre joueur est ignoree
- Les limites propres aux entraineurs (2 pour coach, 4 pour super_coach) restent applicables entre eux
- Cette modification corrigera le cas Dislam (super_coach) + Bennani (joueur)

