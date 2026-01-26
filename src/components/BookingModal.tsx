import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { PartnerSelector } from "./PartnerSelector";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoachRestrictions } from "@/hooks/useCoachRestrictions";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  prefilledDate?: Date;
  prefilledCourtId?: string;
  prefilledTime?: string;
}

export const BookingModal = ({ 
  open, 
  onOpenChange, 
  userId, 
  onSuccess,
  prefilledDate,
  prefilledCourtId,
  prefilledTime
}: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedPlayer1, setSelectedPlayer1] = useState("");
  const [selectedPlayer2, setSelectedPlayer2] = useState("");
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [reservationsData, setReservationsData] = useState<any[]>([]);
  const [blockedSlotsData, setBlockedSlotsData] = useState<any[]>([]);
  const [partnerRestrictions, setPartnerRestrictions] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);
  const { isAdmin } = useUserRole(userId);
  const { isCoach: currentUserIsCoach } = useCoachRestrictions(userId);

  // Charger le profil utilisateur pour l'audit
  useEffect(() => {
    if (userId) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUserProfile(data);
        });
    }
  }, [userId]);

  // Helper function to check if a user has an active reservation
  const hasActiveReservation = (reservations: any[], todayStr: string, currentTime: string) => {
    return reservations.some((res) => {
      if (res.date > todayStr) return true;
      if (res.date === todayStr && res.start_time > currentTime) return true;
      return false;
    });
  };

  // Helper function to check if a user is a super_coach
  const isSuperCoach = async (playerId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", playerId)
      .eq("role", "super_coach")
      .maybeSingle();
    
    return !!data;
  };

  // Helper function to check if a user is a coach
  const isCoach = async (playerId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", playerId)
      .eq("role", "coach")
      .maybeSingle();
    
    return !!data;
  };

  // Helper function to check if a user is elite
  const isElite = async (playerId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", playerId)
      .eq("role", "elite")
      .maybeSingle();
    
    return !!data;
  };

  // Helper function to count active reservations
  const countActiveReservations = (reservations: any[], todayStr: string, currentTime: string): number => {
    return reservations.filter((res) => {
      if (res.date > todayStr) return true;
      if (res.date === todayStr && res.start_time > currentTime) return true;
      return false;
    }).length;
  };

  // Helper function to get max reservations based on role
  const getMaxReservations = async (playerId: string): Promise<number> => {
    if (await isSuperCoach(playerId)) return 4;
    if (await isCoach(playerId)) return 2;
    if (await isElite(playerId)) return 999; // Pas de limite globale, seule la limite quotidienne s'applique
    return 1;
  };

  // Empêcher l'ouverture si l'utilisateur est un coach
  useEffect(() => {
    if (open && currentUserIsCoach && !isAdmin) {
      toast.error("Les coachs ne peuvent pas créer de réservations");
      onOpenChange(false);
    }
  }, [open, currentUserIsCoach, isAdmin, onOpenChange]);

  // Charger les restrictions du partenaire sélectionné
  useEffect(() => {
    const checkPartnerRestrictions = async () => {
      const partnerId = isAdmin ? (selectedPlayer1 || selectedPlayer2) : selectedPartner;
      if (!partnerId) {
        setPartnerRestrictions([]);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", partnerId)
        .in("role", ["coach", "super_coach"])
        .maybeSingle();

      if (roles?.role === "coach") {
        // Coach normal : restreindre aux terrains 6,7,8,9,central
        const { data: courts } = await supabase
          .from("courts")
          .select("id")
          .or("court_number.in.(6,7,8,9),is_central.eq.true");

        setPartnerRestrictions(courts?.map((c) => c.id) || []);
      } else {
        setPartnerRestrictions([]); // Pas de restriction
      }
    };

    checkPartnerRestrictions();
  }, [selectedPartner, selectedPlayer1, selectedPlayer2, isAdmin]);

  // Initialize with prefilled data if provided
  useEffect(() => {
    if (open && prefilledDate && prefilledCourtId && prefilledTime) {
      setSelectedDate(prefilledDate);
      setSelectedCourt(prefilledCourtId);
      setSelectedTime(prefilledTime);
      handleSlotSelect(prefilledDate);
      setStep(2); // Skip to partner selection
    }
  }, [open, prefilledDate, prefilledCourtId, prefilledTime]);

  // Filter slots based on selected court
  const getFilteredSlots = () => {
    if (!selectedCourt) return [];

    const allSlots = [];
    for (let hour = 7; hour < 21; hour++) {
      allSlots.push(`${hour.toString().padStart(2, "0")}:00:00`);
    }

    return allSlots.filter((slot) => {
      // Check if blocked (for this specific court OR global blocks with court_id = null)
      const isBlocked = blockedSlotsData.some(
        (b) =>
          (b.court_id === selectedCourt || b.court_id === null) &&
          slot >= b.start_time &&
          slot < b.end_time
      );

      // Check if reserved
      const isReserved = reservationsData.some(
        (r) => r.court_id === selectedCourt && r.start_time === slot
      );

      return !isBlocked && !isReserved;
    });
  };

  // Reload slots when court changes
  const handleCourtChange = async (courtId: string) => {
    setSelectedCourt(courtId);
    setSelectedTime(""); // Reset time when court changes
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    
    // Normaliser la date à minuit en heure locale pour éviter les problèmes de timezone
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    setSelectedDate(normalizedDate);
    
    // Check for active reservation limits (pas pour les admins)
    if (!isAdmin) {
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
      const todayDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;
      
      const maxReservations = await getMaxReservations(userId);
      
      const { data: activeRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .gte('date', todayStr);

      const activeCount = activeRes ? countActiveReservations(activeRes, todayStr, currentTime) : 0;
      
      if (activeCount >= maxReservations) {
        toast.error(`Vous avez atteint la limite de ${maxReservations} réservation(s) active(s)`);
        return;
      }
    }

    // Load data for step 2
    await handleSlotSelect(date);
    setStep(2);
  };

  const handleSlotSelect = async (date?: Date) => {
    const dateToUse = date || selectedDate;
    if (!dateToUse) return;

    // Fix timezone issue
    const year = dateToUse.getFullYear();
    const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
    const day = String(dateToUse.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const [courtsData, reservations, blocked, profiles] = await Promise.all([
      supabase.from("courts").select("*").order("court_number"),
      supabase.from("reservations").select("*").eq("date", dateStr),
      supabase.from("blocked_slots").select("*").eq("date", dateStr),
      supabase.from("profiles").select("*").neq("id", userId),
    ]);

    if (courtsData.data) setCourts(courtsData.data);
    if (profiles.data) setPartners(profiles.data);
    if (reservations.data) setReservationsData(reservations.data);
    if (blocked.data) setBlockedSlotsData(blocked.data);
  };

  // Vérifier si un joueur a des restrictions de date (coach J+1, elite J+2)
  const checkPlayerDateRestriction = async (playerId: string): Promise<{ ok: boolean; message?: string }> => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", playerId)
      .in("role", ["coach", "super_coach", "elite"]);

    const role = roles?.[0]?.role;
    if (!role) return { ok: true };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (role === "elite") {
      // J+2 pour Elite
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 2);
      maxDate.setHours(23, 59, 59, 999);
      
      if (selectedDate && selectedDate > maxDate) {
        return { ok: false, message: "Les joueurs Elite ne peuvent réserver que jusqu'à après-demain (J+2)" };
      }
    } else {
      // J+1 pour Coach/Super Coach
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      
      if (selectedDate && selectedDate > tomorrow) {
        return { ok: false, message: "Les réservations avec un coach ne sont possibles que pour aujourd'hui ou demain" };
      }
    }
    
    return { ok: true };
  };

  // Vérifier la limite quotidienne de 2h pour les joueurs Elite
  const checkEliteDailyLimit = async (playerId: string, dateStr: string): Promise<{ ok: boolean; message?: string }> => {
    const isElitePlayer = await isElite(playerId);
    if (!isElitePlayer) return { ok: true };

    const { data: reservations } = await supabase
      .from("reservations")
      .select("id")
      .eq("date", dateStr)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    if ((reservations?.length || 0) >= 2) {
      return { ok: false, message: "Limite de 2 heures par jour atteinte pour ce joueur Elite" };
    }
    return { ok: true };
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedCourt || !selectedTime) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (isAdmin && (!selectedPlayer1 || !selectedPlayer2)) {
      toast.error("Veuillez sélectionner les deux joueurs");
      return;
    }

    if (!isAdmin && !selectedPartner) {
      toast.error("Veuillez sélectionner un partenaire");
      return;
    }

    setLoading(true);

    // Vérifier la restriction de date pour les coachs et Elite
    const player1Id = isAdmin ? selectedPlayer1 : userId;
    const player2Id = isAdmin ? selectedPlayer2 : selectedPartner;

    const [player1DateCheck, player2DateCheck] = await Promise.all([
      checkPlayerDateRestriction(player1Id),
      checkPlayerDateRestriction(player2Id),
    ]);

    if (!player1DateCheck.ok) {
      toast.error(player1DateCheck.message);
      setLoading(false);
      return;
    }

    if (!player2DateCheck.ok) {
      toast.error(player2DateCheck.message);
      setLoading(false);
      return;
    }
    try {
      // Fix timezone issue: use local date without timezone conversion
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Vérifier la limite quotidienne Elite avant de créer la réservation
      const [elite1Check, elite2Check] = await Promise.all([
        checkEliteDailyLimit(player1Id, dateStr),
        checkEliteDailyLimit(player2Id, dateStr),
      ]);

      if (!elite1Check.ok) {
        toast.error(isAdmin 
          ? "Le joueur 1 (Elite) a atteint sa limite de 2h pour ce jour"
          : "Vous avez atteint votre limite de 2 heures pour cette journée"
        );
        setLoading(false);
        return;
      }

      if (!elite2Check.ok) {
        toast.error(isAdmin 
          ? "Le joueur 2 (Elite) a atteint sa limite de 2h pour ce jour"
          : "Votre partenaire (Elite) a atteint sa limite de 2 heures pour cette journée"
        );
        setLoading(false);
        return;
      }
      
      const [hourStr] = selectedTime.split(":");
      const hour = parseInt(hourStr);
      const endTime = `${(hour + 1).toString().padStart(2, "0")}:00:00`;

      // Verify slot is not blocked (check both specific court and global blocks where court_id is null)
      const { data: blockedSlots } = await supabase
        .from("blocked_slots")
        .select("*")
        .eq("date", dateStr)
        .lte("start_time", selectedTime)
        .gt("end_time", selectedTime);
      
      // Filter to only include blocks for this court or global blocks (court_id is null)
      const relevantBlocks = blockedSlots?.filter(
        (b) => b.court_id === selectedCourt || b.court_id === null
      );

      if (relevantBlocks && relevantBlocks.length > 0) {
        toast.error("Ce créneau est bloqué");
        setLoading(false);
        return;
      }

      // Verify slot is not already reserved
      const { data: existingReservations } = await supabase
        .from("reservations")
        .select("*")
        .eq("date", dateStr)
        .eq("court_id", selectedCourt)
        .eq("start_time", selectedTime);

      if (existingReservations && existingReservations.length > 0) {
        toast.error("Ce créneau est déjà réservé");
        setLoading(false);
        return;
      }

      // Verify both players don't have active reservations
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
      const todayDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;

      // Check player 1 reservation limit
      const player1MaxRes = await getMaxReservations(player1Id);
      const { data: player1ActiveRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${player1Id},player2_id.eq.${player1Id}`)
        .gte('date', todayStr);

      const player1ActiveCount = player1ActiveRes ? countActiveReservations(player1ActiveRes, todayStr, currentTime) : 0;

      if (player1ActiveCount >= player1MaxRes) {
        const roleLabel = player1MaxRes === 4 ? "super coach" : player1MaxRes === 2 ? "coach" : "joueur";
        toast.error(isAdmin 
          ? `Le joueur 1 a atteint sa limite de ${player1MaxRes} réservation(s) (${roleLabel})`
          : `Vous avez atteint la limite de ${player1MaxRes} réservation(s) active(s)`
        );
        setLoading(false);
        return;
      }

      // Check player 2 reservation limit
      const player2MaxRes = await getMaxReservations(player2Id);
      const { data: player2ActiveRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${player2Id},player2_id.eq.${player2Id}`)
        .gte('date', todayStr);

      const player2ActiveCount = player2ActiveRes ? countActiveReservations(player2ActiveRes, todayStr, currentTime) : 0;

      if (player2ActiveCount >= player2MaxRes) {
        const roleLabel = player2MaxRes === 4 ? "super coach" : player2MaxRes === 2 ? "coach" : "joueur";
        toast.error(isAdmin 
          ? `Le joueur 2 a atteint sa limite de ${player2MaxRes} réservation(s) (${roleLabel})`
          : `Votre partenaire a atteint sa limite de ${player2MaxRes} réservation(s)`
        );
        setLoading(false);
        return;
      }

      const reservationData = {
        court_id: selectedCourt,
        date: dateStr,
        start_time: selectedTime,
        end_time: endTime,
        player1_id: isAdmin ? selectedPlayer1 : userId,
        player2_id: isAdmin ? selectedPlayer2 : selectedPartner,
        created_by: userId,
      };
      
      const { data: insertedRes, error } = await supabase
        .from("reservations")
        .insert(reservationData)
        .select()
        .single();
      
      if (error) throw error;

      // Logger la création dans l'audit
      const player1Profile = partners.find(p => p.id === reservationData.player1_id);
      const player2Profile = partners.find(p => p.id === reservationData.player2_id);
      const courtName = courts.find(c => c.id === reservationData.court_id)?.name;
      
      const player1Name = isAdmin 
        ? (player1Profile?.full_name || "Joueur 1") 
        : (userProfile?.full_name || "Inconnu");
      const player2Name = isAdmin 
        ? (player2Profile?.full_name || "Joueur 2") 
        : (partners.find(p => p.id === selectedPartner)?.full_name || "Partenaire");

      try {
        await supabase.rpc("log_action", {
          _performed_by: userId,
          _performer_name: userProfile?.full_name || "Inconnu",
          _action_type: "CREATE",
          _entity_type: "RESERVATION",
          _entity_id: insertedRes?.id || null,
          _old_values: null,
          _new_values: {
            date: reservationData.date,
            court: courtName,
            start_time: reservationData.start_time,
            end_time: reservationData.end_time,
            player1: player1Name,
            player2: player2Name,
          },
          _description: `Nouvelle réservation: ${player1Name} avec ${player2Name} le ${reservationData.date}`,
        });
      } catch (auditErr) {
        console.error("Erreur audit log:", auditErr);
      }

      toast.success("Réservation créée avec succès !");
      onSuccess();
      onOpenChange(false);
      resetModal();
      // Force page refresh to show new reservation
      window.location.reload();
    } catch (error: any) {
      console.error("❌ ERREUR DÉTAILLÉE:", error);
      const message = error?.message ?? "";

      if (
        message.includes("row-level security") ||
        message.includes("new row violates row-level security policy")
      ) {
        toast.error(
          "Votre réservation ne peut pas être acceptée car vous avez déjà une réservation active."
        );
      } else {
        toast.error(`Erreur: ${message || "Une erreur est survenue lors de la création de la réservation."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedDate(undefined);
    setSelectedCourt("");
    setSelectedTime("");
    setSelectedPartner("");
    setSelectedPlayer1("");
    setSelectedPlayer2("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-xl">Réserver un terrain</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center space-y-4 py-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              className="pointer-events-auto rounded-md border p-3"
            />
            <p className="text-sm text-muted-foreground text-center px-4">
              Sélectionnez une date
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Terrain</label>
              <Select value={selectedCourt} onValueChange={handleCourtChange}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Sélectionnez un terrain" />
                </SelectTrigger>
                <SelectContent>
                  {courts
                    .filter((court) => 
                      partnerRestrictions.length === 0 || 
                      partnerRestrictions.includes(court.id)
                    )
                    .map((court) => (
                      <SelectItem key={court.id} value={court.id} className="py-3">
                        {court.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">Créneau</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Sélectionnez un créneau" />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredSlots().map((slot) => {
                    const hour = parseInt(slot.split(":")[0]);
                    return (
                      <SelectItem key={slot} value={slot} className="py-3">
                        {hour}h - {hour + 1}h
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {isAdmin ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Joueur 1</label>
                  <PartnerSelector
                    userId={userId}
                    selectedDate={selectedDate!}
                    value={selectedPlayer1}
                    onValueChange={setSelectedPlayer1}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium block">Joueur 2</label>
                  <PartnerSelector
                    userId={userId}
                    selectedDate={selectedDate!}
                    value={selectedPlayer2}
                    onValueChange={setSelectedPlayer2}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium block">Partenaire</label>
                <PartnerSelector
                  userId={userId}
                  selectedDate={selectedDate!}
                  value={selectedPartner}
                  onValueChange={setSelectedPartner}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="h-12 flex-1">
                Retour
              </Button>
              <Button onClick={handleConfirm} disabled={loading} className="h-12 flex-[2]">
                {loading ? "Création..." : "Confirmer la réservation"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
