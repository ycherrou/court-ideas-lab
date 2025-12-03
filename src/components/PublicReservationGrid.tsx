import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    
    const intervalId = setInterval(updateCurrentHour, 60000);
    
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
        <div className="h-full w-full bg-destructive/20 flex flex-col items-center justify-center p-1">
          <span className="font-bold text-destructive text-xs">BLOQUÉ</span>
          <span className="text-[8px] text-destructive/70 truncate max-w-full">{blocked.reason}</span>
        </div>
      );
    }

    const reservation = reservations.find(
      (res) => res.court_id === courtId && res.start_time === timeStr
    );

    if (reservation) {
      return (
        <div className="h-full w-full bg-primary/20 flex flex-col items-center justify-center p-1">
          <span className="font-semibold text-primary text-[10px] truncate max-w-full leading-tight">
            {reservation.player1?.full_name || ''}
          </span>
          <span className="text-primary/60 text-[8px]">&</span>
          <span className="font-semibold text-primary text-[10px] truncate max-w-full leading-tight">
            {reservation.player2?.full_name || ''}
          </span>
        </div>
      );
    }

    // Available slot - empty with subtle pattern
    return (
      <div className="h-full w-full bg-emerald-500/10"></div>
    );
  };

  if (loading) {
    return <Skeleton className="w-full h-[500px]" />;
  }

  const allHours = getAllHours();
  
  // Vérifier si on affiche aujourd'hui
  const today = new Date();
  const isToday = 
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr>
            {/* Corner cell - Court header */}
            <th className="sticky left-0 z-20 bg-primary text-primary-foreground font-bold text-sm p-3 border border-border min-w-[120px]">
              Terrain
            </th>
            {/* Hour headers */}
            {allHours.map((hour) => {
              const isCurrentHour = isToday && hour === currentHour;
              return (
                <th
                  key={hour}
                  className={`font-bold text-sm p-2 border border-border min-w-[70px] transition-all ${
                    isCurrentHour
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-lg">{hour}h</span>
                    {isCurrentHour && (
                      <span className="text-[10px] animate-pulse">● maintenant</span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {courts.map((court, index) => (
            <tr key={court.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
              {/* Court name - sticky left */}
              <td className="sticky left-0 z-10 bg-secondary text-secondary-foreground font-bold text-sm p-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {court.court_number}
                  </span>
                  <span className="truncate">{court.name}</span>
                </div>
              </td>
              {/* Time slots */}
              {allHours.map((hour) => {
                const isCurrentHour = isToday && hour === currentHour;
                return (
                  <td
                    key={`${court.id}-${hour}`}
                    className={`border border-border h-[80px] p-0 transition-all ${
                      isCurrentHour ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''
                    }`}
                  >
                    {getSlotContent(court.id, hour)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-500/10 border border-border rounded"></div>
          <span className="text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary/20 border border-border rounded"></div>
          <span className="text-muted-foreground">Réservé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-destructive/20 border border-border rounded"></div>
          <span className="text-muted-foreground">Bloqué</span>
        </div>
      </div>
    </div>
  );
};
