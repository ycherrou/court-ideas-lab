import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { MobileReservationCard } from "@/components/MobileReservationCard";
import { MobileNav } from "@/components/MobileNav";

const MyReservations = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const [activeReservations, setActiveReservations] = useState<any[]>([]);
  const [pastReservations, setPastReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !roleLoading) {
      fetchReservations();
    }
  }, [user, isAdmin, roleLoading]);

  const fetchReservations = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("reservations")
        .select(`
          *,
          court:courts(name),
          player1:player1_id(full_name),
          player2:player2_id(full_name)
        `);

      // Si l'utilisateur n'est pas admin, filtrer par ses réservations
      if (!isAdmin) {
        query = query.or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
      }

      const { data } = await query
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (data) {
        const now = new Date();
        // Fix timezone issue - use local date
        const todayYear = now.getFullYear();
        const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
        const todayDay = String(now.getDate()).padStart(2, '0');
        const today = `${todayYear}-${todayMonth}-${todayDay}`;
        const currentTime = now.toTimeString().split(" ")[0];

        const active = data.filter((res: any) => {
          if (res.date > today) return true;
          if (res.date === today && res.start_time > currentTime) return true;
          return false;
        });

        const past = data.filter((res: any) => {
          if (res.date < today) return true;
          if (res.date === today && res.start_time <= currentTime) return true;
          return false;
        });

        setActiveReservations(active);
        setPastReservations(past);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette réservation ?")) return;

    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de l'annulation");
    } else {
      toast.success("Réservation annulée");
      fetchReservations();
    }
  };

  if (authLoading || roleLoading || loading) {
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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">{isAdmin ? "Toutes les réservations" : "Mes réservations"}</h1>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="border-b md:hidden sticky top-0 bg-background z-30">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{isAdmin ? "Toutes les réservations" : "Mes réservations"}</h1>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8 space-y-6 md:space-y-8">
        {/* Active Reservations - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Réservations à venir</CardTitle>
            <CardDescription>
              {activeReservations.length} réservation{activeReservations.length > 1 ? "s" : ""} active{activeReservations.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeReservations.length === 0 ? (
              <p className="text-muted-foreground">Aucune réservation active</p>
            ) : (
              <div className="space-y-4">
                {activeReservations.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">
                        {new Date(res.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {res.start_time.slice(0, 5)} - {res.end_time.slice(0, 5)} • {res.court?.name}
                      </p>
                      <p className="text-sm">
                        {isAdmin 
                          ? `${res.player1?.full_name} vs ${res.player2?.full_name}`
                          : `Avec ${res.player1?.id === user.id 
                              ? res.player2?.full_name
                              : res.player1?.full_name
                            }`
                        }
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(res.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Reservations - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="px-2">
            <h2 className="text-lg font-semibold mb-1">À venir</h2>
            <p className="text-sm text-muted-foreground">
              {activeReservations.length} réservation{activeReservations.length > 1 ? "s" : ""}
            </p>
          </div>
          {activeReservations.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground text-center text-sm">Aucune réservation active</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeReservations.map((res) => (
                <MobileReservationCard
                  key={res.id}
                  reservation={res}
                  userId={user.id}
                  onCancel={handleCancel}
                  showCancelButton
                />
              ))}
            </div>
          )}
        </div>

        {/* Past Reservations - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Historique</CardTitle>
            <CardDescription>
              {pastReservations.length} réservation{pastReservations.length > 1 ? "s" : ""} passée{pastReservations.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pastReservations.length === 0 ? (
              <p className="text-muted-foreground">Aucune réservation passée</p>
            ) : (
              <div className="space-y-4">
                {pastReservations.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-4 border rounded-lg opacity-60"
                  >
                    <div>
                      <p className="font-semibold">
                        {new Date(res.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {res.start_time.slice(0, 5)} - {res.end_time.slice(0, 5)} • {res.court?.name}
                      </p>
                      <p className="text-sm">
                        {isAdmin 
                          ? `${res.player1?.full_name} vs ${res.player2?.full_name}`
                          : `Avec ${res.player1?.id === user.id 
                              ? res.player2?.full_name
                              : res.player1?.full_name
                            }`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Reservations - Mobile */}
        <div className="md:hidden space-y-3">
          <div className="px-2">
            <h2 className="text-lg font-semibold mb-1">Historique</h2>
            <p className="text-sm text-muted-foreground">
              {pastReservations.length} réservation{pastReservations.length > 1 ? "s" : ""}
            </p>
          </div>
          {pastReservations.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground text-center text-sm">Aucune réservation passée</p>
            </Card>
          ) : (
            <div className="space-y-3 opacity-60">
              {pastReservations.map((res) => (
                <MobileReservationCard
                  key={res.id}
                  reservation={res}
                  userId={user.id}
                  onCancel={handleCancel}
                  showCancelButton={false}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav userId={user.id} onBookingOpen={() => {}} />
    </div>
  );
};

export default MyReservations;
