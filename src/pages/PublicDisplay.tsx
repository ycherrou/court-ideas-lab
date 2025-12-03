import { useEffect, useState } from "react";
import { PublicReservationGrid } from "@/components/PublicReservationGrid";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import rtcmaLogo from "@/assets/rtcma-logo.png";

const PublicDisplay = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gérer le mode plein écran
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Erreur lors du changement de mode plein écran:", error);
    }
  };

  // Écouter les changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Horloge en temps réel - mise à jour chaque seconde
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Rafraîchissement automatique - toutes les minutes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setCurrentDate(new Date());
      setLastRefresh(new Date());
    }, 60000); // 60 secondes

    return () => clearInterval(refreshInterval);
  }, []);

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Header compact */}
      <header className="border-b-2 border-primary bg-background px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <img src={rtcmaLogo} alt="RTCMA Logo" className="h-10 w-auto" />
          
          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Réservations du jour
            </h1>
            <p className="text-sm text-primary font-medium">
              {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </div>
          
          {/* Clock and Fullscreen Button */}
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold font-mono text-foreground tabular-nums">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              size="sm"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content - takes all remaining space */}
      <main className="flex-1 p-2 min-h-0">
        <PublicReservationGrid date={currentDate} />
      </main>

      {/* Footer compact */}
      <footer className="bg-muted border-t px-4 py-1 shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Actualisation automatique</span>
          </div>
          <span>Mise à jour : {format(lastRefresh, 'HH:mm:ss')}</span>
        </div>
      </footer>
    </div>
  );
};

export default PublicDisplay;
