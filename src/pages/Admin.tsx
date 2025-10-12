import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Trash2, Calendar, Ban } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import rtcLogo from "@/assets/rtc-logo.png";

const newMemberSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const [members, setMembers] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!roleLoading && !isAdmin) {
      navigate("/");
      toast.error("Accès non autorisé");
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      const [membersData, reservationsData, blockedData, courtsData] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase
          .from("reservations")
          .select(`
            *,
            court:courts(name),
            player1:player1_id(first_name, last_name),
            player2:player2_id(first_name, last_name)
          `)
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date")
          .order("start_time"),
        supabase.from("blocked_slots").select("*, court:courts(name)").order("date"),
        supabase.from("courts").select("*").order("court_number"),
      ]);

      if (membersData.data) setMembers(membersData.data);
      if (reservationsData.data) setReservations(reservationsData.data as any);
      if (blockedData.data) setBlockedSlots(blockedData.data as any);
      if (courtsData.data) setCourts(courtsData.data);
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette réservation ?")) return;

    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de l'annulation");
    } else {
      toast.success("Réservation annulée");
      fetchData();
    }
  };

  const handleDeleteBlockedSlot = async (id: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Blocage supprimé");
      fetchData();
    }
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    try {
      newMemberSchema.parse(data);

      const { error } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
      });

      if (error) throw error;

      toast.success("Membre ajouté avec succès");
      setAddMemberOpen(false);
      fetchData();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleCreateBlockedSlot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const courtIdValue = formData.get("courtId");
    const data = {
      date: formData.get("date") as string,
      start_time: formData.get("startTime") as string,
      end_time: formData.get("endTime") as string,
      reason: formData.get("reason") as string,
      court_id: courtIdValue === "all" ? null : (courtIdValue as string),
      created_by: user?.id,
    };

    const { error } = await supabase.from("blocked_slots").insert([data]);

    if (error) {
      toast.error("Erreur lors de la création");
    } else {
      toast.success("Créneaux bloqués avec succès");
      fetchData();
      (e.target as HTMLFormElement).reset();
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Panneau d'administration</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="members">Membres</TabsTrigger>
            <TabsTrigger value="reservations">Réservations</TabsTrigger>
            <TabsTrigger value="blocked">Blocages</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestion des membres</CardTitle>
                    <CardDescription>
                      {members.length} membre{members.length > 1 ? "s" : ""} inscrit{members.length > 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Ajouter un membre
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajouter un nouveau membre</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddMember} className="space-y-4">
                        <div>
                          <Label htmlFor="firstName">Prénom</Label>
                          <Input id="firstName" name="firstName" required />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Nom</Label>
                          <Input id="lastName" name="lastName" required />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" name="email" type="email" required />
                        </div>
                        <div>
                          <Label htmlFor="password">Mot de passe</Label>
                          <Input id="password" name="password" type="password" required />
                        </div>
                        <Button type="submit" className="w-full">
                          Créer le membre
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Date d'inscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          {member.first_name} {member.last_name}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Réservations à venir</CardTitle>
                <CardDescription>{reservations.length} réservation{reservations.length > 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Horaire</TableHead>
                      <TableHead>Terrain</TableHead>
                      <TableHead>Joueurs</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell>
                          {new Date(res.date).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          {res.start_time.slice(0, 5)} - {res.end_time.slice(0, 5)}
                        </TableCell>
                        <TableCell>{res.court?.name}</TableCell>
                        <TableCell>
                          {res.player1?.first_name} {res.player1?.last_name} & {res.player2?.first_name} {res.player2?.last_name}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteReservation(res.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bloquer des créneaux</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateBlockedSlot} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required />
                      </div>
                      <div>
                        <Label htmlFor="courtId">Terrain</Label>
                        <Select name="courtId" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous les terrains</SelectItem>
                            {courts.map((court) => (
                              <SelectItem key={court.id} value={court.id}>
                                {court.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="startTime">Heure début</Label>
                        <Input id="startTime" name="startTime" type="time" required />
                      </div>
                      <div>
                        <Label htmlFor="endTime">Heure fin</Label>
                        <Input id="endTime" name="endTime" type="time" required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="reason">Raison</Label>
                      <Textarea id="reason" name="reason" required />
                    </div>
                    <Button type="submit">
                      <Ban className="h-4 w-4 mr-2" />
                      Bloquer les créneaux
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Créneaux bloqués</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Horaire</TableHead>
                        <TableHead>Terrain</TableHead>
                        <TableHead>Raison</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedSlots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>
                            {new Date(slot.date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </TableCell>
                          <TableCell>{slot.court?.name || "Tous"}</TableCell>
                          <TableCell>{slot.reason}</TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteBlockedSlot(slot.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
