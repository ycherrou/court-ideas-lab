import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  player1_id: string;
  player2_id: string;
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

export const PublicReservationGrid = ({ date }: { date: Date }) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("public-reservations-changes")
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
            player1_id,
            player2_id,
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
      console.error("Erreur lors du chargement des données", error);
    } finally {
      setLoading(false);
    }
  };

  const getSlotContent = (courtId: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, "0")}:00:00`;

    const blocked = blockedSlots.find(
      (slot) =>
        (slot.court_id === courtId || slot.court_id === null) &&
        slot.start_time <= timeStr &&
        slot.end_time > timeStr
    );

    if (blocked) {
      return (
        <div className="h-full bg-destructive/30 border-2 border-destructive/60 flex items-center justify-center p-3 text-center">
          <div>
            <div className="font-bold text-lg">BLOQUÉ</div>
            <div className="text-sm text-muted-foreground mt-1">{blocked.reason}</div>
          </div>
        </div>
      );
    }

    const reservation = reservations.find(
      (res) => res.court_id === courtId && res.start_time === timeStr
    );

    if (reservation) {
      return (
        <div className="h-full bg-accent border-2 border-accent-foreground/20 flex items-center justify-center p-3 text-center">
          <div className="leading-tight">
            <div className="font-semibold text-base truncate">
              {reservation.player1?.full_name || ''}
            </div>
            <div className="text-muted-foreground text-sm my-1">&</div>
            <div className="font-semibold text-base truncate">
              {reservation.player2?.full_name || ''}
            </div>
          </div>
        </div>
      );
    }

    // Available slot
    return (
      <div className="h-full bg-success/20 border-2 border-success/50 flex items-center justify-center text-lg font-medium text-success">
        Disponible
      </div>
    );
  };

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  const filteredHours = getFilteredHours(date);

  return (
    <ScrollArea className="w-full h-[calc(100vh-200px)]">
      <div className="min-w-max pb-6">
        <div className="grid grid-cols-[120px_repeat(10,minmax(150px,1fr))] gap-2">
          {/* Empty corner cell - sticky */}
          <div className="font-bold text-xl p-4 bg-muted sticky top-0 left-0 z-20 border-r-2 border-b-2"></div>
          
          {/* Court headers - sticky top */}
          {courts.map((court) => (
            <div 
              key={court.id} 
              className="font-bold text-xl p-4 bg-muted text-center sticky top-0 z-10 border-b-2"
            >
              {court.name}
            </div>
          ))}

          {filteredHours.map((hour) => (
            <>
              {/* Hour labels - sticky left */}
              <div 
                key={`hour-${hour}`} 
                className="font-bold text-xl p-4 bg-muted flex items-center justify-center sticky left-0 z-10 border-r-2"
              >
                {hour}h
              </div>
              
              {/* Court slots */}
              {courts.map((court) => (
                <Card key={`${court.id}-${hour}`} className="min-h-[100px] overflow-hidden border-2">
                  {getSlotContent(court.id, hour)}
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
