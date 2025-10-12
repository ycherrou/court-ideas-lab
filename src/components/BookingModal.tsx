import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays } from "date-fns";

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

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    
    // Check for active reservation
    const dateStr = date.toISOString().split("T")[0];
    const { data: activeRes } = await supabase
      .from("reservations")
      .select("*")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .gte("date", new Date().toISOString().split("T")[0]);

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

    const dateStr = dateToUse.toISOString().split("T")[0];
    const [courtsData, reservations, blocked, profiles] = await Promise.all([
      supabase.from("courts").select("*").order("court_number"),
      supabase.from("reservations").select("*").eq("date", dateStr),
      supabase.from("blocked_slots").select("*").eq("date", dateStr),
      supabase.from("profiles").select("*").neq("id", userId),
    ]);

    if (courtsData.data) setCourts(courtsData.data);
    if (profiles.data) setPartners(profiles.data);

    // Generate available time slots (7h to 20h)
    const slots = [];
    for (let hour = 7; hour < 21; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00:00`);
    }
    setAvailableSlots(slots);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedCourt || !selectedTime || !selectedPartner) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const [hourStr] = selectedTime.split(":");
      const hour = parseInt(hourStr);
      const endTime = `${(hour + 1).toString().padStart(2, "0")}:00:00`;

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Réserver un terrain</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today || date > addDays(new Date(), 7);
              }}
              className="pointer-events-auto"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Terrain</label>
              <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un terrain" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Créneau</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un créneau" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.map((slot) => {
                    const hour = parseInt(slot.split(":")[0]);
                    return (
                      <SelectItem key={slot} value={slot}>
                        {hour}h - {hour + 1}h
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Partenaire</label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un partenaire" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.first_name} {partner.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                {loading ? "Création..." : "Confirmer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
