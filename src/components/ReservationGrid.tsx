import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Court {
  id: string;
  name: string;
  court_number: number;
}

interface Reservation {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  player1: { first_name: string; last_name: string };
  player2: { first_name: string; last_name: string };
}

interface BlockedSlot {
  id: string;
  court_id: string | null;
  start_time: string;
  end_time: string;
  reason: string;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h

export const ReservationGrid = ({ 
  date, 
  userId, 
  onSlotClick 
}: { 
  date: Date; 
  userId?: string;
  onSlotClick?: (courtId: string, courtName: string, hour: number) => void;
}) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const dateString = date.toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("reservations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocked_slots" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date]);

  const fetchData = async () => {
    try {
      const [courtsData, reservationsData, blockedData] = await Promise.all([
        supabase.from("courts").select("*").order("court_number"),
        supabase
          .from("reservations")
          .select(
            `
            id,
            court_id,
            start_time,
            end_time,
            player1:player1_id(first_name, last_name),
            player2:player2_id(first_name, last_name)
          `
          )
          .eq("date", dateString),
        supabase.from("blocked_slots").select("*").eq("date", dateString),
      ]);

      if (courtsData.data) setCourts(courtsData.data);
      if (reservationsData.data) setReservations(reservationsData.data as any);
      if (blockedData.data) setBlockedSlots(blockedData.data);
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const getSlotContent = (courtId: string, courtName: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, "0")}:00:00`;
    const endTimeStr = `${(hour + 1).toString().padStart(2, "0")}:00:00`;

    const blocked = blockedSlots.find(
      (slot) =>
        (slot.court_id === courtId || slot.court_id === null) &&
        slot.start_time <= timeStr &&
        slot.end_time > timeStr
    );

    if (blocked) {
      return (
        <div className="h-full bg-destructive/20 border-destructive/40 flex items-center justify-center p-1 md:p-2 text-center text-[10px] md:text-xs">
          <div>
            <div className="font-semibold">BLOQUÉ</div>
            <div className="text-muted-foreground hidden md:block">{blocked.reason}</div>
          </div>
        </div>
      );
    }

    const reservation = reservations.find(
      (res) => res.court_id === courtId && res.start_time === timeStr
    );

    if (reservation) {
      const isMyReservation =
        userId &&
        (reservation.player1?.first_name || reservation.player2?.first_name);

      return (
        <div
          className={`h-full flex items-center justify-center p-2 text-center text-xs ${
            isMyReservation ? "bg-primary/20 border-primary" : "bg-accent"
          }`}
        >
          <div>
            <div className="font-medium">
              {reservation.player1?.first_name} {reservation.player1?.last_name}
            </div>
            <div className="text-muted-foreground">&</div>
            <div className="font-medium">
              {reservation.player2?.first_name} {reservation.player2?.last_name}
            </div>
          </div>
        </div>
      );
    }

    // Available slot - clickable
    return (
      <button
        onClick={() => onSlotClick?.(courtId, courtName, hour)}
        className="h-full w-full bg-success/10 hover:bg-success/20 active:bg-success/30 border-success/40 flex items-center justify-center text-xs text-muted-foreground transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="hidden md:block">Disponible</span>
          <span className="text-[10px] md:hidden">✓</span>
        </div>
      </button>
    );
  };

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  return (
    <div className="overflow-x-auto overflow-y-auto -mx-2 md:mx-0 max-h-[calc(100vh-250px)]">
      <div className="min-w-max px-2 md:px-0">
        <div className="grid grid-cols-[60px_repeat(10,minmax(100px,1fr))] md:grid-cols-[100px_repeat(10,minmax(120px,1fr))] gap-1">
          {/* Empty corner cell - sticky */}
          <div className="font-semibold p-1 md:p-2 bg-muted sticky top-0 left-0 z-20"></div>
          
          {/* Court headers - sticky top */}
          {courts.map((court) => (
            <div 
              key={court.id} 
              className="font-semibold p-1 md:p-2 bg-muted text-center text-xs md:text-sm sticky top-0 z-10"
            >
              {court.name.replace("Terrain ", "T")}
            </div>
          ))}

          {HOURS.map((hour) => (
            <>
              {/* Hour labels - sticky left */}
              <div 
                key={`hour-${hour}`} 
                className="font-medium p-1 md:p-2 bg-muted text-xs md:text-sm sticky left-0 z-10"
              >
                {hour}h
              </div>
              
              {/* Court slots */}
              {courts.map((court) => (
                <Card key={`${court.id}-${hour}`} className="min-h-[60px] md:min-h-[80px] overflow-hidden">
                  {getSlotContent(court.id, court.name, hour)}
                </Card>
              ))}
            </>
          ))}
        </div>
      </div>
    </div>
  );
};
