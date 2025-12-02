import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

// Afficher toutes les heures de 7h à 20h
const getAllHours = () => {
  return Array.from({ length: 14 }, (_, i) => i + 7);
};

export const PublicReservationGrid = ({ date }: { date: Date }) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  // Mettre à jour l'heure actuelle chaque minute
  useEffect(() => {
    const updateCurrentHour = () => {
      setCurrentHour(new Date().getHours());
    };
    
    const intervalId = setInterval(updateCurrentHour, 60000); // Toutes les 60 secondes
    
    return () => clearInterval(intervalId);
  }, []);

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
        <div className="h-full bg-destructive/30 border-2 border-destructive/60 flex items-center justify-center p-2 text-center">
          <div className="w-full">
            <div className="font-bold text-[11px] leading-tight">BLOQUÉ</div>
            <div className="text-[9px] text-muted-foreground mt-1 truncate">{blocked.reason}</div>
          </div>
        </div>
      );
    }

    const reservation = reservations.find(
      (res) => res.court_id === courtId && res.start_time === timeStr
    );

    if (reservation) {
      return (
        <div className="h-full bg-accent border-2 border-accent-foreground/20 flex items-center justify-center p-2 text-center">
          <div className="leading-tight w-full">
            <div className="font-semibold text-[11px] truncate px-1">
              {reservation.player1?.full_name || ''}
            </div>
            <div className="text-muted-foreground text-[9px] my-0.5">&</div>
            <div className="font-semibold text-[11px] truncate px-1">
              {reservation.player2?.full_name || ''}
            </div>
          </div>
        </div>
      );
    }

    // Available slot - empty
    return (
      <div className="h-full bg-success/20 border-2 border-success/50"></div>
    );
  };

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  const allHours = getAllHours();
  
  // Vérifier si on affiche aujourd'hui
  const today = new Date();
  const isToday = 
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return (
    <div className="w-full h-[calc(100vh-200px)] overflow-hidden">
      <div className="h-full">
        <div className="grid grid-cols-[60px_repeat(10,1fr)] gap-0.5 h-full">
          {/* Empty corner cell */}
          <div className="font-bold text-sm p-1 bg-muted border-r border-b"></div>
          
          {/* Court headers */}
          {courts.map((court) => (
            <div 
              key={court.id} 
              className="font-bold text-sm p-1 bg-muted text-center border-b"
            >
              {court.name}
            </div>
          ))}

          {allHours.map((hour) => {
            const isCurrentHour = isToday && hour === currentHour;
            
            return (
              <>
                {/* Hour labels */}
                <div 
                  key={`hour-${hour}`} 
                  className={`font-bold text-sm p-1 flex items-center justify-center border-r ${
                    isCurrentHour 
                      ? 'bg-primary text-primary-foreground animate-pulse' 
                      : 'bg-muted'
                  }`}
                >
                  {hour}h
                  {isCurrentHour && (
                    <span className="ml-1 text-[10px]">●</span>
                  )}
                </div>
                
                {/* Court slots */}
                {courts.map((court) => (
                  <Card 
                    key={`${court.id}-${hour}`} 
                    className={`overflow-hidden ${
                      isCurrentHour 
                        ? 'border-4 border-primary shadow-lg' 
                        : 'border'
                    }`}
                  >
                    {getSlotContent(court.id, hour)}
                  </Card>
                ))}
              </>
            );
          })}
        </div>
      </div>
    </div>
  );
};
