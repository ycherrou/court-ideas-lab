import { Card } from "./ui/card";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface MobileReservationCardProps {
  reservation: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    court?: { name: string };
    player1?: { id: string; full_name: string };
    player2?: { id: string; full_name: string };
  };
  userId: string;
  onCancel: (id: string) => void;
  showCancelButton?: boolean;
}

export function MobileReservationCard({
  reservation,
  userId,
  onCancel,
  showCancelButton = true,
}: MobileReservationCardProps) {
  const partnerName =
    reservation.player1?.id === userId
      ? reservation.player2?.full_name
      : reservation.player1?.full_name;

  return (
    <Card className="p-4 space-y-3 active:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">
              {format(parseISO(reservation.date), "EEEE d MMMM", { locale: fr })}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
              {reservation.start_time.slice(0, 5)} - {reservation.end_time.slice(0, 5)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{reservation.court?.name}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Avec {partnerName}</span>
          </div>
        </div>

        {showCancelButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(reservation.id)}
            className="shrink-0"
          >
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        )}
      </div>
    </Card>
  );
}
