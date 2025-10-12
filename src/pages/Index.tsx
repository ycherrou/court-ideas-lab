import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ReservationGrid } from "@/components/ReservationGrid";
import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, LogOut, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from "@/components/ui/carousel";
import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefilledBooking, setPrefilledBooking] = useState<{
    date: Date;
    courtId: string;
    time: string;
  } | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Generate 7 days starting from today
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const handleSlotClick = (courtId: string, courtName: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, "0")}:00:00`;
    setPrefilledBooking({
      date: new Date(),
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
    if (!api) return;
    
    // Start at first slide (today)
    setCurrentSlide(0);

    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

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
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Tennis Club</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 mr-2" />
                Gestion
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/mes-reservations")}>
              Mes réservations
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
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Tennis Club</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        {/* Desktop Title and Button */}
        <div className="mb-6 hidden md:flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Réservations de la semaine
          </h2>
          <Button onClick={() => setBookingOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Réserver un terrain
          </Button>
        </div>

        {/* Mobile Title */}
        <div className="mb-4 md:hidden">
          <h2 className="text-base font-semibold text-center">
            Prochains 7 jours
          </h2>
        </div>

        <Carousel
          setApi={setApi}
          className="w-full"
          opts={{
            align: "center",
            loop: false,
            dragFree: false,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10"></div>
            <div className="text-center flex-1">
              <h3 className="text-lg font-semibold">
                {format(weekDays[currentSlide], 'EEEE d MMMM yyyy', { locale: fr })}
              </h3>
              {currentSlide === 0 && (
                <span className="text-sm text-primary">Aujourd'hui</span>
              )}
            </div>
            <CarouselNext className="relative static translate-y-0" />
          </div>
          
          <CarouselContent>
            {weekDays.map((day, index) => (
              <CarouselItem key={index}>
                <ReservationGrid 
                  key={`${refreshKey}-${index}`} 
                  date={day} 
                  userId={user.id} 
                  onSlotClick={handleSlotClick}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
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
    </div>
  );
};

export default Index;
