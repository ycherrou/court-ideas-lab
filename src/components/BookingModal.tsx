import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { PartnerSelector } from "./PartnerSelector";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

export const BookingModal = ({ open, onOpenChange, userId, onSuccess }: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [reservationsData, setReservationsData] = useState<any[]>([]);
  const [blockedSlotsData, setBlockedSlotsData] = useState<any[]>([]);

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
    
    // Check for active reservation
    const dateStr = format(date, "yyyy-MM-dd");
    const { data: activeRes } = await supabase
      .from("reservations")
      .select("*")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .gte("date", format(new Date(), "yyyy-MM-dd"));

    if (activeRes && activeRes.length > 0) {
      toast.error("Vous avez déjà une réservation active");
      return;
    }

    // Load data for step 2
    await handleSlotSelect(date);
    setStep(2);
  };

  const handleSlotSelect = async (date?: Date) => {
    const dateToUse = date || selectedDate;
    if (!dateToUse) return;

    const dateStr = format(dateToUse, "yyyy-MM-dd");
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
    if (!selectedDate || !selectedCourt || !selectedTime || !selectedPartner) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
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

      const { error } = await supabase.from("reservations").insert({
        court_id: selectedCourt,
        date: dateStr,
        start_time: selectedTime,
        end_time: endTime,
        player1_id: userId,
        player2_id: selectedPartner,
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
      toast.error(error.message);
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
                  {courts.map((court) => (
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

            <div className="space-y-2">
              <label className="text-sm font-medium block">Partenaire</label>
              <PartnerSelector
                userId={userId}
                selectedDate={selectedDate!}
                value={selectedPartner}
                onValueChange={setSelectedPartner}
              />
            </div>

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
