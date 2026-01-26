

## Corriger la limite de réservations pour les joueurs Elite

### Problème identifié
La fonction `getMaxReservations` ne gère pas le rôle "elite". Les joueurs Elite sont donc traités comme des joueurs normaux avec une limite de 1 réservation active globalement.

Or, les règles pour Elite sont différentes :
- **Pas de limite globale** de réservations actives
- **2 heures maximum par jour** (cette vérification existe déjà via `checkEliteDailyLimit`)
- Horizon J, J+1, J+2

### Solution
Modifier `getMaxReservations` pour exclure les joueurs Elite de la limite globale en leur attribuant une limite très élevée (999), car leur vraie restriction est la limite quotidienne de 2h qui est déjà vérifiée ailleurs.

### Modification à apporter

**Fichier** : `src/components/BookingModal.tsx`

**Lignes 119-123** - Ajouter la vérification Elite :

```typescript
const getMaxReservations = async (playerId: string): Promise<number> => {
  if (await isSuperCoach(playerId)) return 4;
  if (await isCoach(playerId)) return 2;
  if (await isElite(playerId)) return 999; // Pas de limite globale, seule la limite quotidienne s'applique
  return 1;
};
```

### Résumé des changements
| Fichier | Modification |
|---------|--------------|
| `src/components/BookingModal.tsx` | Ajouter `if (await isElite(playerId)) return 999;` dans `getMaxReservations` |

### Impact
- Camil et les autres joueurs Elite pourront créer des réservations
- Ils resteront limités à 2h par jour grâce à `checkEliteDailyLimit`
- Ils resteront limités à l'horizon J+2 grâce à `checkPlayerDateRestriction`

