import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  player1: { full_name: string };
  player2: { full_name: string };
}

interface BlockedSlot {
  id: string;
  court_id: string | null;
  start_time: string;
  end_time: string;
  reason: string;
}

const getFilteredHours = (date: Date) => {
  const now = new Date();
  // Fix timezone issue - use local date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayString = `${todayYear}-${todayMonth}-${todayDay}`;
  
  // Si c'est aujourd'hui, filtrer les heures passées
  if (dateString === todayString) {
    const currentHour = now.getHours();
    return Array.from({ length: 14 }, (_, i) => i + 7).filter(hour => hour >= currentHour);
  }
  
  // Sinon, afficher toutes les heures
  return Array.from({ length: 14 }, (_, i) => i + 7);
};

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

  // Fix timezone issue - use local date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

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
            player1:player1_id(full_name),
            player2:player2_id(full_name)
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
        <div className="h-full bg-destructive/20 border-destructive/40 flex items-center justify-center p-0.5 md:p-2 text-center text-[8px] md:text-xs">
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
        (reservation.player1?.full_name || reservation.player2?.full_name);
      
      const player1FirstName = reservation.player1?.full_name?.split(' ')[0] || '';
      const player2FirstName = reservation.player2?.full_name?.split(' ')[0] || '';

      return (
        <div
          className={`h-full flex items-center justify-center p-0.5 md:p-2 text-center text-[8px] md:text-xs ${
            isMyReservation ? "bg-primary/20 border-primary" : "bg-accent"
          }`}
        >
          <div className="leading-tight">
            <div className="font-medium truncate">
              {player1FirstName}
            </div>
            <div className="text-muted-foreground text-[6px] md:text-xs">&</div>
            <div className="font-medium truncate">
              {player2FirstName}
            </div>
          </div>
        </div>
      );
    }

    // Available slot - clickable
    return (
      <button
        onClick={() => onSlotClick?.(courtId, courtName, hour)}
        className="h-full w-full bg-success/10 hover:bg-success/20 active:bg-success/30 border-success/40 flex items-center justify-center text-[8px] md:text-xs text-muted-foreground transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center">
          <span className="hidden md:block">Disponible</span>
          <span className="text-sm md:hidden">✓</span>
        </div>
      </button>
    );
  };

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  const filteredHours = getFilteredHours(date);

  return (
    <ScrollArea className="w-full h-[calc(100vh-280px)] md:h-[calc(100vh-220px)]">
      <div className="min-w-max pb-6">
        <div className="grid grid-cols-[50px_repeat(10,80px)] md:grid-cols-[100px_repeat(10,minmax(120px,1fr))] gap-0.5 md:gap-1">
          {/* Empty corner cell - sticky */}
          <div className="font-semibold p-1 md:p-2 bg-muted sticky top-0 left-0 z-20 border-r border-b"></div>
          
          {/* Court headers - sticky top */}
          {courts.map((court) => (
            <div 
              key={court.id} 
              className="font-semibold p-1 md:p-2 bg-muted text-center text-[10px] md:text-sm sticky top-0 z-10 border-b"
            >
              <span className="md:hidden">{court.court_number}</span>
              <span className="hidden md:inline">{court.name.replace("Terrain ", "T")}</span>
            </div>
          ))}

          {filteredHours.map((hour) => (
            <>
              {/* Hour labels - sticky left */}
              <div 
                key={`hour-${hour}`} 
                className="font-medium p-1 md:p-2 bg-muted text-[10px] md:text-sm flex items-center justify-center sticky left-0 z-10 border-r"
              >
                {hour}h
              </div>
              
              {/* Court slots */}
              {courts.map((court) => (
                <Card key={`${court.id}-${hour}`} className="min-h-[50px] md:min-h-[80px] overflow-hidden border-0 rounded-none">
                  {getSlotContent(court.id, court.name, hour)}
                </Card>
              ))}
            </>
          ))}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};
