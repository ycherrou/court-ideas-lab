

## Corriger l'affichage de la restriction J/J+1 pour les Super Coaches dans PartnerSelector

### Probleme identifie
Le composant `PartnerSelector.tsx` applique la meme restriction visuelle et fonctionnelle aux **coaches** et **super coaches**. A trois endroits (Favoris, Recents, Tous les membres), le code fait :

```typescript
const isCoach = role === 'coach' || role === 'super_coach';
const isDisabled = (isCoach && coachDateRestricted) || ...
```

Les super coaches sont donc grises et affichent "(J/J+1 uniquement)" alors qu'ils ne devraient plus avoir cette restriction.

### Solution
Modifier la logique pour ne restreindre que les `coach` (pas les `super_coach`) :

**Fichier** : `src/components/PartnerSelector.tsx`

**Modifications a apporter** (3 sections identiques) :

Lignes 235-237, 285-288, 336-339 :

```text
Avant :
  const isCoach = role === 'coach' || role === 'super_coach';
  const isDisabled = (isCoach && coachDateRestricted) || (isElitePlayer && eliteDateRestricted);

Apres :
  const isCoachOnly = role === 'coach';  // super_coach n'a plus de restriction de date
  const isDisabled = (isCoachOnly && coachDateRestricted) || (isElitePlayer && eliteDateRestricted);
```

Et aussi modifier l'affichage du badge "(J/J+1 uniquement)" :

```text
Avant :
  {isCoach && isDisabled && ' (J/J+1 uniquement)'}

Apres :
  {isCoachOnly && isDisabled && ' (J/J+1 uniquement)'}
```

### Resume des changements
- Les **coaches** restent limites a J/J+1 et affichent le badge
- Les **super coaches** peuvent etre selectionnes pour n'importe quelle date
- Les icones restent inchangees (coach = raquette, super coach = etoile + raquette)

### Impact
Cette modification complete celle deja faite dans `BookingModal.tsx` pour assurer une coherence totale de l'experience utilisateur.

