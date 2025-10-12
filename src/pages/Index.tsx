import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ReservationGrid } from "@/components/ReservationGrid";
import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, LogOut, Settings } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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
            Réservations du {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>
          <Button onClick={() => setBookingOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Réserver un terrain
          </Button>
        </div>

        {/* Mobile Title */}
        <div className="mb-4 md:hidden">
          <h2 className="text-base font-semibold text-center">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
        </div>

        <ReservationGrid key={refreshKey} date={new Date()} userId={user.id} />
      </main>

      {/* Mobile Navigation */}
      <MobileNav userId={user.id} onBookingOpen={() => setBookingOpen(true)} />

      <BookingModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        userId={user.id}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
};

export default Index;
