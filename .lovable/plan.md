

## Bloquer les administrateurs dans les réservations

### Problème identifié

En analysant la base de données, j'ai trouvé une réservation existante :
- **Joueur 1** : TIFNOUTI REDOUANE (joueur)
- **Joueur 2** : Administrateur (admin)
- **Date** : 2026-02-07

Le code dans `PartnerSelector.tsx` (lignes 91-117) exclut bien les admins de la liste, mais il y a une faille : les **réservations passées** avec un admin apparaissent dans la section "Récents" (lignes 129-152) et peuvent être sélectionnées de nouveau.

### Solution en 3 niveaux

#### 1. Corriger le filtrage des récents dans PartnerSelector.tsx

**Fichier** : `src/components/PartnerSelector.tsx`

**Lignes 136-152** - Filtrer les admins de la liste des partenaires récents :

```text
Avant :
  recentReservations.forEach((r) => {
    const partnerId = r.player1_id === userId ? r.player2_id : r.player1_id;
    if (!recentIds.has(partnerId)) {
      recentIds.add(partnerId);
      const partner = profiles.find((p) => p.id === partnerId);
      if (partner) {
        recentPartnersList.push(partner);
      }
    }
  });

Après :
  recentReservations.forEach((r) => {
    const partnerId = r.player1_id === userId ? r.player2_id : r.player1_id;
    // Ne pas inclure les admins dans les récents
    if (!recentIds.has(partnerId) && !adminIds.includes(partnerId)) {
      recentIds.add(partnerId);
      const partner = profiles.find((p) => p.id === partnerId);
      if (partner) {
        recentPartnersList.push(partner);
      }
    }
  });
```

#### 2. Ajouter une validation dans BookingModal.tsx

**Fichier** : `src/components/BookingModal.tsx`

Ajouter une fonction de vérification et un blocage dans `handleConfirm` :

```text
// Nouvelle fonction après isElite (ligne 107)
const isAdminPlayer = async (playerId: string): Promise<boolean> => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", playerId)
    .eq("role", "admin")
    .maybeSingle();
  
  return !!data;
};

// Dans handleConfirm, après la vérification de date (vers ligne 350)
const [player1IsAdmin, player2IsAdmin] = await Promise.all([
  isAdminPlayer(player1Id),
  isAdminPlayer(player2Id),
]);

if (player1IsAdmin || player2IsAdmin) {
  toast.error("Les administrateurs ne peuvent pas participer aux réservations");
  setLoading(false);
  return;
}
```

#### 3. Ajouter un trigger de validation en base de données

**Migration SQL** - Créer un trigger qui bloque les réservations avec un admin :

```sql
CREATE OR REPLACE FUNCTION validate_no_admin_in_reservation()
RETURNS TRIGGER AS $$
BEGIN
  IF has_role(NEW.player1_id, 'admin') OR has_role(NEW.player2_id, 'admin') THEN
    RAISE EXCEPTION 'Les administrateurs ne peuvent pas participer aux reservations';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_no_admin_in_reservation
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION validate_no_admin_in_reservation();
```

### Résumé des modifications

| Niveau | Fichier/Ressource | Modification |
|--------|-------------------|--------------|
| Frontend | `PartnerSelector.tsx` | Exclure admins de la section "Récents" |
| Frontend | `BookingModal.tsx` | Bloquer si player1 ou player2 est admin |
| Base de données | Trigger SQL | Bloquer l'insertion si admin impliqué |

### Impact
- Aucun administrateur ne pourra être sélectionné comme joueur ou partenaire
- Les réservations existantes avec un admin resteront visibles mais aucune nouvelle ne pourra être créée
- Protection à 3 niveaux : UI (liste), validation (code), contrainte (BDD)

