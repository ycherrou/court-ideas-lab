import React, { useEffect, useState } from "react";
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
          .select(`
            id, court_id, start_time, end_time, player1_id, player2_id,
            player1:player1_id(full_name),
            player2:player2_id(full_name)
          `)
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
        <div className="h-full w-full bg-destructive/30 flex flex-col items-center justify-center px-1">
          <span className="font-bold text-destructive text-[10px] uppercase leading-tight">
            {blocked.reason || 'BLOQUÉ'}
          </span>
        </div>
      );
    }

    const reservation = reservations.find(
      (res) => res.court_id === courtId && res.start_time === timeStr
    );

    if (reservation) {
      return (
        <div className="h-full w-full bg-primary/25 flex flex-col items-center justify-center px-1">
          <span className="font-semibold text-primary text-[11px] truncate max-w-full leading-tight">
            {reservation.player1?.full_name || ''}
          </span>
          <span className="font-semibold text-primary text-[11px] truncate max-w-full leading-tight">
            {reservation.player2?.full_name || ''}
          </span>
        </div>
      );
    }

    return <div className="h-full w-full bg-emerald-500/15"></div>;
  };

  if (loading) {
    return <Skeleton className="w-full h-full" />;
  }

  const allHours = getAllHours();
  const today = new Date();
  const isToday = 
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Grid container */}
      <div 
        className="flex-1 grid min-w-0"
        style={{
          gridTemplateColumns: `100px repeat(${allHours.length}, minmax(0, 1fr))`,
          gridTemplateRows: `36px repeat(${courts.length}, 1fr)`,
        }}
      >
        {/* Header: Corner */}
        <div className="bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center border border-border">
          Terrain
        </div>
        
        {/* Header: Hours */}
        {allHours.map((hour) => {
          const isCurrentHour = isToday && hour === currentHour;
          return (
            <div
              key={hour}
              className={`font-bold text-xs flex items-center justify-center border border-border ${
                isCurrentHour
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {hour}h
              {isCurrentHour && <span className="ml-0.5 animate-pulse text-[10px]">●</span>}
            </div>
          );
        })}

        {/* Rows: Courts and slots */}
        {courts.map((court) => (
          <React.Fragment key={court.id}>
            {/* Court name */}
            <div
              className="bg-secondary text-secondary-foreground font-bold text-xs flex items-center gap-1 px-1 border border-border"
            >
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                {court.court_number}
              </span>
              <span className="truncate text-[11px]">
                {court.court_number === 10 ? 'Central' : `T${court.court_number}`}
              </span>
            </div>
            
            {/* Time slots */}
            {allHours.map((hour) => {
              const isCurrentHour = isToday && hour === currentHour;
              return (
                <div
                  key={`${court.id}-${hour}`}
                  className={`border border-border ${
                    isCurrentHour ? 'ring-2 ring-inset ring-primary' : ''
                  }`}
                >
                  {getSlotContent(court.id, hour)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-2 text-xs shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-500/15 border border-border rounded"></div>
          <span className="text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary/25 border border-border rounded"></div>
          <span className="text-muted-foreground">Réservé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-destructive/30 border border-border rounded"></div>
          <span className="text-muted-foreground">Bloqué</span>
        </div>
      </div>
    </div>
  );
};
