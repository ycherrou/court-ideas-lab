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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-primary bg-background shrink-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <img src={rtcmaLogo} alt="RTCMA Logo" className="h-14 w-auto" />
            </div>
            
            {/* Title */}
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-foreground">
                Réservations du jour
              </h1>
              <p className="text-xl text-primary font-medium">
                {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
            
            {/* Clock and Fullscreen Button */}
            <div className="text-right flex flex-col items-end gap-2">
              <div className="text-4xl font-bold font-mono text-foreground tabular-nums">
                {format(currentTime, 'HH:mm:ss')}
              </div>
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {isFullscreen ? (
                  <>
                    <Minimize className="h-4 w-4" />
                    Quitter
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4" />
                    Plein écran
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-2 py-2 overflow-hidden">
        <PublicReservationGrid date={currentDate} />
      </main>

      {/* Footer with refresh info */}
      <footer className="bg-muted/95 backdrop-blur border-t py-1 shrink-0">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-muted-foreground">Actualisation automatique</span>
            </div>
            <div className="text-muted-foreground">
              Mise à jour : {format(lastRefresh, 'HH:mm:ss')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicDisplay;
