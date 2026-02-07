import { useState, useEffect } from "react";
import { Star, Search, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PartnerSelectorProps {
  userId: string;
  selectedDate: Date;
  value: string;
  onValueChange: (value: string) => void;
  showCoachDateWarning?: boolean; // Afficher l'avertissement si date > J+1
}

interface Partner {
  id: string;
  full_name: string;
  email: string;
}

export function PartnerSelector({
  userId,
  selectedDate,
  value,
  onValueChange,
}: PartnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Partner[]>([]);
  const [recents, setRecents] = useState<Partner[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [coachRoles, setCoachRoles] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  // Vérifier si la date sélectionnée dépasse J+1 (restriction coach)
  const isDateBeyondTomorrow = (): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    return selectedDate > tomorrow;
  };

  // Vérifier si la date sélectionnée dépasse J+2 (restriction elite)
  const isDateBeyondJ2 = (): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const j2 = new Date(today);
    j2.setDate(j2.getDate() + 2);
    j2.setHours(23, 59, 59, 999);
    return selectedDate > j2;
  };

  const coachDateRestricted = isDateBeyondTomorrow();
  const eliteDateRestricted = isDateBeyondJ2();

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    // Load favorites
    const { data: favData } = await supabase
      .from("favorite_partners")
      .select("favorite_user_id")
      .eq("user_id", userId);

    const favIds = new Set(favData?.map((f) => f.favorite_user_id) || []);
    setFavoriteIds(favIds);

    // Get admin user IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = adminRoles?.map((r) => r.user_id) || [];

    // Load coach and elite roles
    const { data: coachRolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["coach", "super_coach", "elite"]);

    const coachMap = new Map<string, string>();
    coachRolesData?.forEach((r) => coachMap.set(r.user_id, r.role));
    setCoachRoles(coachMap);

    // Load all partners except current user and admins (include coaches)
    let profilesQuery = supabase
      .from("profiles")
      .select("*")
      .neq("id", userId)
      .order("full_name");

    if (adminIds.length > 0) {
      profilesQuery = profilesQuery.not("id", "in", `(${adminIds.join(",")})`);
    }

    const { data: profiles } = await profilesQuery;

    if (profiles) {
      setAllPartners(profiles);

      // Filter favorites
      const favPartners = profiles.filter((p) => favIds.has(p.id));
      setFavorites(favPartners);

      // Load recent partners from reservations
      const { data: recentReservations } = await supabase
        .from("reservations")
        .select("player1_id, player2_id, created_at")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentReservations) {
        const recentIds = new Set<string>();
        const recentPartnersList: Partner[] = [];

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

        setRecents(recentPartnersList.slice(0, 10));
      }
    }
  };

  const toggleFavorite = async (partnerId: string) => {
    const isFavorite = favoriteIds.has(partnerId);

    if (isFavorite) {
      // Remove from favorites
      const { error } = await supabase
        .from("favorite_partners")
        .delete()
        .eq("user_id", userId)
        .eq("favorite_user_id", partnerId);

      if (!error) {
        const newFavIds = new Set(favoriteIds);
        newFavIds.delete(partnerId);
        setFavoriteIds(newFavIds);
        setFavorites(favorites.filter((f) => f.id !== partnerId));
        toast({ description: "Retiré des favoris" });
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from("favorite_partners")
        .insert({ user_id: userId, favorite_user_id: partnerId });

      if (!error) {
        const newFavIds = new Set(favoriteIds);
        newFavIds.add(partnerId);
        setFavoriteIds(newFavIds);
        const partner = allPartners.find((p) => p.id === partnerId);
        if (partner) {
          setFavorites([...favorites, partner]);
        }
        toast({ description: "Ajouté aux favoris" });
      }
    }
  };

  const filterPartners = (partners: Partner[]) => {
    if (!searchQuery) return partners;
    const query = searchQuery.toLowerCase();
    return partners.filter(
      (p) =>
        p.full_name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
    );
  };

  const selectedPartner = allPartners.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedPartner
            ? selectedPartner.full_name
            : "Sélectionnez un partenaire"}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un partenaire..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>Aucun partenaire trouvé.</CommandEmpty>

            {/* Favorites Section */}
            {favorites.length > 0 && !searchQuery && (
              <CommandGroup heading="⭐ Favoris">
                {filterPartners(favorites).map((partner) => {
                  const role = coachRoles.get(partner.id);
                  const isCoachOnly = role === 'coach';  // super_coach n'a plus de restriction de date
                  const isElitePlayer = role === 'elite';
                  const isDisabled = (isCoachOnly && coachDateRestricted) || (isElitePlayer && eliteDateRestricted);
                  return (
                    <CommandItem
                      key={partner.id}
                      value={partner.id}
                      onSelect={() => {
                        if (isDisabled) {
                          const msg = isElitePlayer 
                            ? "Réservation avec un joueur Elite possible uniquement jusqu'à J+2"
                            : "Réservation avec un coach possible uniquement pour aujourd'hui ou demain";
                          toast({ description: msg, variant: "destructive" });
                          return;
                        }
                        onValueChange(partner.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className={cn(value === partner.id && "font-medium")}>
                        {partner.full_name}
                        {role === 'coach' && ' 🎾'}
                        {role === 'super_coach' && ' ⭐🎾'}
                        {role === 'elite' && ' ⚡'}
                        {isCoachOnly && isDisabled && ' (J/J+1 uniquement)'}
                        {isElitePlayer && isDisabled && ' (J/J+1/J+2 uniquement)'}
                      </span>
                      <Star
                        className="h-4 w-4 cursor-pointer fill-yellow-400 text-yellow-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(partner.id);
                        }}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Recents Section */}
            {recents.length > 0 && !searchQuery && (
              <CommandGroup heading="🕒 Récents">
                {filterPartners(recents)
                  .filter((p) => !favoriteIds.has(p.id))
                  .map((partner) => {
                  const role = coachRoles.get(partner.id);
                  const isCoachOnly = role === 'coach';  // super_coach n'a plus de restriction de date
                  const isElitePlayer = role === 'elite';
                  const isDisabled = (isCoachOnly && coachDateRestricted) || (isElitePlayer && eliteDateRestricted);
                    return (
                      <CommandItem
                        key={partner.id}
                        value={partner.id}
                        onSelect={() => {
                          if (isDisabled) {
                            const msg = isElitePlayer 
                              ? "Réservation avec un joueur Elite possible uniquement jusqu'à J+2"
                              : "Réservation avec un coach possible uniquement pour aujourd'hui ou demain";
                            toast({ description: msg, variant: "destructive" });
                            return;
                          }
                          onValueChange(partner.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className={cn(value === partner.id && "font-medium")}>
                          {partner.full_name}
                        {role === 'coach' && ' 🎾'}
                        {role === 'super_coach' && ' ⭐🎾'}
                        {role === 'elite' && ' ⚡'}
                        {isCoachOnly && isDisabled && ' (J/J+1 uniquement)'}
                        {isElitePlayer && isDisabled && ' (J/J+1/J+2 uniquement)'}
                        </span>
                        <Star
                          className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-yellow-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(partner.id);
                          }}
                        />
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            )}

            {/* All Members Section */}
            <CommandGroup heading="👥 Tous les membres">
              {filterPartners(allPartners)
                .filter((p) => !favoriteIds.has(p.id) && !recents.some((r) => r.id === p.id))
                .slice(0, searchQuery ? 200 : 100)
                .map((partner) => {
                  const role = coachRoles.get(partner.id);
                  const isCoachOnly = role === 'coach';  // super_coach n'a plus de restriction de date
                  const isElitePlayer = role === 'elite';
                  const isDisabled = (isCoachOnly && coachDateRestricted) || (isElitePlayer && eliteDateRestricted);
                  return (
                    <CommandItem
                      key={partner.id}
                      value={partner.id}
                      onSelect={() => {
                        if (isDisabled) {
                          const msg = isElitePlayer 
                            ? "Réservation avec un joueur Elite possible uniquement jusqu'à J+2"
                            : "Réservation avec un coach possible uniquement pour aujourd'hui ou demain";
                          toast({ description: msg, variant: "destructive" });
                          return;
                        }
                        onValueChange(partner.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className={cn(value === partner.id && "font-medium")}>
                        {partner.full_name}
                        {role === 'coach' && ' 🎾'}
                        {role === 'super_coach' && ' ⭐🎾'}
                        {role === 'elite' && ' ⚡'}
                        {isCoachOnly && isDisabled && ' (J/J+1 uniquement)'}
                        {isElitePlayer && isDisabled && ' (J/J+1/J+2 uniquement)'}
                      </span>
                      <Star
                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-yellow-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(partner.id);
                        }}
                      />
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
