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
  const { isAdmin } = useUserRole(userId);
  const { isCoach: currentUserIsCoach } = useCoachRestrictions(userId);

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
      // Check if blocked
      const isBlocked = blockedSlotsData.some(
        (b) =>
          b.court_id === selectedCourt &&
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
    setSelectedDate(date);
    
    // Check for active reservation (pas pour les admins créant pour les coachs)
    if (!isAdmin) {
      // Fix timezone issue for date comparison
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
      const todayDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;
      
      const { data: activeRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .or(`date.gt.${todayStr},and(date.eq.${todayStr},start_time.gt.${currentTime})`);

      if (activeRes && activeRes.length > 0) {
        toast.error("Vous avez déjà une réservation active");
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
    try {
      // Fix timezone issue: use local date without timezone conversion
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const [hourStr] = selectedTime.split(":");
      const hour = parseInt(hourStr);
      const endTime = `${(hour + 1).toString().padStart(2, "0")}:00:00`;

      // Verify slot is not blocked
      const { data: blockedSlots } = await supabase
        .from("blocked_slots")
        .select("*")
        .eq("date", dateStr)
        .eq("court_id", selectedCourt)
        .lte("start_time", selectedTime)
        .gte("end_time", selectedTime);

      if (blockedSlots && blockedSlots.length > 0) {
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

      const player1Id = isAdmin ? selectedPlayer1 : userId;
      const player2Id = isAdmin ? selectedPlayer2 : selectedPartner;

      // Check player 1
      const { data: player1ActiveRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${player1Id},player2_id.eq.${player1Id}`)
        .or(`date.gt.${todayStr},and(date.eq.${todayStr},start_time.gt.${currentTime})`);

      if (player1ActiveRes && player1ActiveRes.length > 0) {
        toast.error(isAdmin ? "Le joueur 1 a déjà une réservation active" : "Vous avez déjà une réservation active");
        setLoading(false);
        return;
      }

      // Check player 2
      const { data: player2ActiveRes } = await supabase
        .from("reservations")
        .select("*")
        .or(`player1_id.eq.${player2Id},player2_id.eq.${player2Id}`)
        .or(`date.gt.${todayStr},and(date.eq.${todayStr},start_time.gt.${currentTime})`);

      if (player2ActiveRes && player2ActiveRes.length > 0) {
        toast.error(isAdmin ? "Le joueur 2 a déjà une réservation active" : "Votre partenaire a déjà une réservation active");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("reservations").insert({
        court_id: selectedCourt,
        date: dateStr,
        start_time: selectedTime,
        end_time: endTime,
        player1_id: isAdmin ? selectedPlayer1 : userId,
        player2_id: isAdmin ? selectedPlayer2 : selectedPartner,
        created_by: userId,
      });

      if (error) throw error;

      toast.success("Réservation créée avec succès !");
      onSuccess();
      onOpenChange(false);
      resetModal();
      // Force page refresh to show new reservation
      window.location.reload();
    } catch (error: any) {
      console.error("Erreur lors de la création de la réservation", error);
      const message = error?.message ?? "";

      if (
        message.includes("row-level security") ||
        message.includes("new row violates row-level security policy")
      ) {
        toast.error(
          "Votre réservation ne peut pas être acceptée car vous avez déjà une réservation active."
        );
      } else {
        toast.error("Une erreur est survenue lors de la création de la réservation.");
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
                return date < today || date > addDays(new Date(), 7);
              }}
              className="pointer-events-auto rounded-md border p-3"
            />
            <p className="text-sm text-muted-foreground text-center px-4">
              Sélectionnez une date dans les 7 prochains jours
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
