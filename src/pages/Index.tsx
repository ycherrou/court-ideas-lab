import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoachRestrictions } from "@/hooks/useCoachRestrictions";
import { ReservationGrid } from "@/components/ReservationGrid";
import { BookingModal } from "@/components/BookingModal";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, LogOut, Settings, ChevronLeft, ChevronRight, KeyRound } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import rtcmaLogo from "@/assets/rtcma-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const { isCoach } = useCoachRestrictions(user?.id);
  const isMobile = useIsMobile();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefilledBooking, setPrefilledBooking] = useState<{
    date: Date;
    courtId: string;
    time: string;
  } | null>(null);
  const [selectedViewDate, setSelectedViewDate] = useState<Date>(new Date());
  const [userName, setUserName] = useState<string>("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleSlotClick = (courtId: string, courtName: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, "0")}:00:00`;
    setPrefilledBooking({
      date: selectedViewDate,
      courtId,
      time: timeStr,
    });
    setBookingOpen(true);
  };

  const handleBookingClose = (open: boolean) => {
    setBookingOpen(open);
    if (!open) {
      setPrefilledBooking(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (data?.full_name) {
          setUserName(data.full_name);
        }
      }
    };
    
    fetchUserName();
  }, [user?.id]);


  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="border-b hidden md:block">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={rtcmaLogo} alt="RTCMA Logo" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {userName || user.email}
            </span>
            {isAdmin ? (
              <>
                <Button variant="outline" onClick={() => navigate("/admin")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Gestion
                </Button>
                <Button variant="outline" onClick={() => navigate("/mes-reservations")}>
                  Toutes les réservations
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate("/mes-reservations")}>
                Mes réservations
              </Button>
            )}
            <Button variant="ghost" onClick={() => setChangePasswordOpen(true)} title="Changer le mot de passe">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="border-b md:hidden sticky top-0 bg-background z-30">
        <div className="px-4 py-3 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <img src={rtcmaLogo} alt="RTCMA Logo" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        {/* Desktop Title and Button */}
        <div className="mb-6 hidden md:flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Réservations de la semaine
          </h2>
            {!isCoach && (
              <Button onClick={() => setBookingOpen(true)}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Réserver un terrain
              </Button>
            )}
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedViewDate(addDays(selectedViewDate, -1))}
            disabled={isToday(selectedViewDate)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Jour précédent</span>
          </Button>
          
          <div className="text-center flex-1 flex flex-col items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-lg font-semibold hover:bg-muted px-3">
                  {format(selectedViewDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  {isToday(selectedViewDate) && (
                    <span className="text-sm text-primary ml-2">Aujourd'hui</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedViewDate}
                  onSelect={(date) => date && setSelectedViewDate(date)}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {!isToday(selectedViewDate) && (
              <Button 
                variant="link" 
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setSelectedViewDate(new Date())}
              >
                Revenir à aujourd'hui
              </Button>
            )}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedViewDate(addDays(selectedViewDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Jour suivant</span>
          </Button>
        </div>

        {/* Reservation Grid */}
        <div className="h-[calc(100vh-280px)] md:h-[calc(100vh-260px)]">
          <ReservationGrid 
            key={`${refreshKey}-${selectedViewDate.toISOString()}`} 
            date={selectedViewDate} 
            userId={user.id} 
            onSlotClick={handleSlotClick}
          />
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav userId={user.id} onBookingOpen={() => setBookingOpen(true)} />

      <BookingModal
        open={bookingOpen}
        onOpenChange={handleBookingClose}
        userId={user.id}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        prefilledDate={prefilledBooking?.date}
        prefilledCourtId={prefilledBooking?.courtId}
        prefilledTime={prefilledBooking?.time}
      />

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
};

export default Index;
