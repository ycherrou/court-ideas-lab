

## Supprimer la restriction J/J+1 pour les Super Coaches

### Probleme actuel
Dans `BookingModal.tsx`, la fonction `checkPlayerDateRestriction` applique la meme restriction de date aux **coaches** et aux **super coaches** : ils ne peuvent reserver que pour aujourd'hui (J) ou demain (J+1).

Les super coaches devraient pouvoir reserver sans limite de date, comme les joueurs normaux.

### Solution
Modifier la fonction `checkPlayerDateRestriction` pour exclure les super coaches de la verification J+1.

### Modification a apporter

**Fichier** : `src/components/BookingModal.tsx`

**Lignes 271-306** - Modifier la logique pour ne plus restreindre les super coaches :

```text
Avant :
  } else {
    // J+1 pour Coach/Super Coach
    const tomorrow = new Date(today);
    ...
  }

Apres :
  } else if (role === "coach") {
    // J+1 seulement pour Coach (pas super_coach)
    const tomorrow = new Date(today);
    ...
  }
  // super_coach : pas de restriction de date
```

### Resume des regles apres modification

| Role | Terrains | Reservations actives | Horizon de dates |
|------|----------|---------------------|------------------|
| Joueur | Tous | 1 | Illimite |
| Elite | Tous | Illimite (2h/jour) | J+2 |
| Coach | 5,6,7,8,9,Central | 2 | J+1 |
| **Super Coach** | Tous | 4 | **Illimite** (modifie) |
| Admin | Tous | Illimite | Illimite |

### Impact
- Les super coaches pourront reserver pour n'importe quelle date future
- Les coaches restent limites a J/J+1
- Aucun impact sur les autres roles

