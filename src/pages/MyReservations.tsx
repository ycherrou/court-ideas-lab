import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

const MyReservations = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeReservations, setActiveReservations] = useState<any[]>([]);
  const [pastReservations, setPastReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReservations();
    }
  }, [user]);

  const fetchReservations = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("reservations")
        .select(`
          *,
          court:courts(name),
          player1:player1_id(first_name, last_name),
          player2:player2_id(first_name, last_name)
        `)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (data) {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Mes réservations</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card>
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
                        Avec {res.player1?.id === user.id 
                          ? `${res.player2?.first_name} ${res.player2?.last_name}`
                          : `${res.player1?.first_name} ${res.player1?.last_name}`
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

        <Card>
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
                        Avec {res.player1?.id === user.id 
                          ? `${res.player2?.first_name} ${res.player2?.last_name}`
                          : `${res.player1?.first_name} ${res.player1?.last_name}`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyReservations;
