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
import { ArrowLeft, UserPlus, Trash2, Calendar, Ban, Edit, Search, Upload, Eye, EyeOff, KeyRound, History, X } from "lucide-react";
import { BulkImportModal } from "@/components/BulkImportModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { BlockedSlotsHistory } from "@/components/BlockedSlotsHistory";
import { ReservationSettingsTab } from "@/components/ReservationSettingsTab";
import { z } from "zod";

const newMemberSchema = z.object({
  fullName: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
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
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [showPins, setShowPins] = useState<Set<string>>(new Set());
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);
  
  // Filtres réservations
  const [reservationSearchQuery, setReservationSearchQuery] = useState("");
  const [reservationDateFilter, setReservationDateFilter] = useState("");
  const [reservationCourtFilter, setReservationCourtFilter] = useState("");

  // Helper pour logger les actions d'audit
  const logAuditAction = async (
    actionType: "CREATE" | "UPDATE" | "DELETE",
    entityType: "RESERVATION" | "MEMBER" | "ROLE" | "BLOCKED_SLOT" | "PASSWORD" | "BULK_IMPORT",
    entityId: string | null,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    description: string
  ) => {
    try {
      await supabase.rpc("log_action", {
        _performed_by: user?.id || null,
        _performer_name: userProfile?.full_name || "Inconnu",
        _action_type: actionType,
        _entity_type: entityType,
        _entity_id: entityId,
        _old_values: oldValues,
        _new_values: newValues,
        _description: description,
      });
    } catch (err) {
      console.error("Erreur audit log:", err);
    }
  };

  useEffect(() => {
    // Attendre que l'auth ET le rôle soient résolus avant de rediriger
    if (authLoading || roleLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    if (!isAdmin) {
      navigate("/");
      toast.error("Accès non autorisé");
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      // Charger le profil de l'utilisateur actuel pour l'audit
      if (user?.id) {
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    }
  }, [isAdmin, user?.id]);

  const fetchData = async () => {
    try {
      // Fix timezone issue - use local date
      const now = new Date();
      const todayYear = now.getFullYear();
      const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
      const todayDay = String(now.getDate()).padStart(2, '0');
      const today = `${todayYear}-${todayMonth}-${todayDay}`;
      
      const [membersData, reservationsData, blockedData, courtsData] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase
          .from("reservations")
          .select(`
            *,
            court:courts(name),
            player1:player1_id(full_name),
            player2:player2_id(full_name)
          `)
          .gte("date", today)
          .order("date")
          .order("start_time"),
        supabase.from("blocked_slots").select("*, court:courts(name)").order("date"),
        supabase.from("courts").select("*").order("court_number"),
      ]);

      // Charger les membres avec leurs rôles séparément
      if (membersData.data) {
        const memberIds = membersData.data.map(m => m.id);
        // IMPORTANT: chunk the IN query to avoid URL-length limits when there are many users.
        const chunkArray = <T,>(arr: T[], size: number) => {
          const chunks: T[][] = [];
          for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
          return chunks;
        };

        const idChunks = chunkArray(memberIds, 200);
        const roleResponses = await Promise.all(
          idChunks.map((ids) =>
            supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", ids)
          )
        );

        const firstError = roleResponses.find((r) => r.error)?.error;
        if (firstError) {
          console.error("Error fetching roles:", firstError);
          toast.error("Erreur lors du chargement des rôles");
        }

        const roles = roleResponses.flatMap((r) => r.data ?? []);

        const membersWithRoles = membersData.data.map(member => ({
          ...member,
          user_roles: roles?.filter(r => r.user_id === member.id) || []
        }));

        setMembers(membersWithRoles);
      }
      
      // Filtrer les réservations passées
      if (reservationsData.data) {
        const now = new Date();
        const currentDate = today; // Use the same today variable defined above
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
        
        const futureReservations = reservationsData.data.filter((res: any) => {
          if (res.date > currentDate) return true;
          if (res.date === currentDate && res.start_time >= currentTime) return true;
          return false;
        });
        
        setReservations(futureReservations as any);
      }
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

    // Récupérer les infos avant suppression pour l'audit
    const reservation = reservations.find((r) => r.id === id);

    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de l'annulation");
    } else {
      // Logger l'action
      await logAuditAction(
        "DELETE",
        "RESERVATION",
        id,
        {
          date: reservation?.date,
          court: reservation?.court?.name,
          start_time: reservation?.start_time,
          end_time: reservation?.end_time,
          player1: reservation?.player1?.full_name,
          player2: reservation?.player2?.full_name,
        },
        null,
        `Annulation réservation: ${reservation?.player1?.full_name} vs ${reservation?.player2?.full_name} le ${reservation?.date}`
      );

      toast.success("Réservation annulée");
      fetchData();
    }
  };

  const handleDeleteBlockedSlot = async (id: string) => {
    // Récupérer les infos avant suppression
    const slot = blockedSlots.find((s) => s.id === id);

    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      await logAuditAction(
        "DELETE",
        "BLOCKED_SLOT",
        id,
        { date: slot?.date, court: slot?.court?.name, reason: slot?.reason, start_time: slot?.start_time, end_time: slot?.end_time },
        null,
        `Suppression blocage: ${slot?.court?.name} le ${slot?.date}`
      );
      toast.success("Blocage supprimé");
      fetchData();
    }
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
    };

    try {
      newMemberSchema.parse(data);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-member`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la création");
      }

      const credentials = result.credentials;
      toast.success(
        `Membre créé avec succès!\nLogin: ${credentials.login}\nPIN: ${credentials.pin}\nEmail: ${credentials.email}`,
        { duration: 10000 }
      );
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

  const handleEditMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      full_name: formData.get("fullName") as string,
      email: formData.get("email") as string,
    };

    const oldProfileData = {
      full_name: selectedMember.full_name,
      email: selectedMember.email,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", selectedMember.id);

    if (profileError) {
      toast.error("Erreur lors de la modification");
      return;
    }

    const newRole = formData.get("role") as string;
    const currentRole = selectedMember.user_roles?.[0]?.role || "player";

    if (newRole !== currentRole) {
      // Supprimer l'ancien rôle AVEC vérification d'erreur
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedMember.id);
      
      if (deleteError) {
        console.error("Erreur suppression rôle:", deleteError);
        toast.error("Erreur lors de la modification du rôle");
        return;
      }
      
      // Ajouter le nouveau rôle
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{ user_id: selectedMember.id, role: newRole as "admin" | "coach" | "player" | "super_coach" | "elite" }]);

      if (roleError) {
        console.error("Erreur insertion nouveau rôle:", roleError);
        // Tenter de restaurer l'ancien rôle pour éviter un état incohérent
        await supabase
          .from("user_roles")
          .insert([{ user_id: selectedMember.id, role: currentRole as "admin" | "coach" | "player" | "super_coach" | "elite" }]);
        
        toast.error("Erreur lors de la modification du rôle");
        return;
      }

      // Logger le changement de rôle
      await logAuditAction(
        "UPDATE",
        "ROLE",
        selectedMember.id,
        { role: currentRole },
        { role: newRole },
        `Changement rôle: ${selectedMember.full_name} (${currentRole} → ${newRole})`
      );
    }

    // Logger la modification du profil
    await logAuditAction(
      "UPDATE",
      "MEMBER",
      selectedMember.id,
      oldProfileData,
      data,
      `Modification profil: ${selectedMember.full_name}`
    );

    toast.success("Membre modifié avec succès");
    setEditMemberOpen(false);
    setSelectedMember(null);
    fetchData();
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce membre ?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-member`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: memberId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      toast.success("Membre supprimé");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression");
    }
  };

  const handleDeleteSelectedMembers = async () => {
    if (selectedMembers.size === 0) return;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedMembers.size} membre(s) ?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const userIds = Array.from(selectedMembers);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-member`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userIds }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      if (result.failed > 0) {
        toast.warning(`${result.deleted} membre(s) supprimé(s), ${result.failed} échec(s)`);
      } else {
        toast.success(`${result.deleted} membre(s) supprimé(s)`);
      }
      
      setSelectedMembers(new Set());
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression");
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const togglePinVisibility = (memberId: string) => {
    const newShowPins = new Set(showPins);
    if (newShowPins.has(memberId)) {
      newShowPins.delete(memberId);
    } else {
      newShowPins.add(memberId);
    }
    setShowPins(newShowPins);
  };

  const handleResetPin = async (memberId: string, memberName: string) => {
    if (!confirm(`Réinitialiser le PIN de ${memberName} ?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-member-pin`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: memberId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la réinitialisation");
      }

      const newPin: string | undefined = result?.pin;
      if (!newPin) throw new Error("PIN manquant dans la réponse");

      // Logger l'action
      await logAuditAction(
        "UPDATE",
        "PASSWORD",
        memberId,
        null,
        { pin_reset: true },
        `Réinitialisation PIN: ${memberName}`
      );

      // Mettre à jour les membres localement immédiatement
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.id === memberId 
            ? { ...member, temporary_pin: newPin, must_change_password: true }
            : member
        )
      );

      // Afficher automatiquement le PIN après réinitialisation
      setShowPins(prev => new Set([...prev, memberId]));
      
      toast.success(`PIN réinitialisé pour ${memberName}\nNouveau PIN: ${newPin}`, { duration: 10000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la réinitialisation du PIN");
    }
  };

  const toggleCourtSelection = (courtId: string) => {
    setSelectedCourts(prev => 
      prev.includes(courtId) 
        ? prev.filter(id => id !== courtId)
        : [...prev, courtId]
    );
  };

  const toggleAllCourts = (checked: boolean) => {
    setSelectedCourts(checked ? courts.map(c => c.id) : []);
  };

  const handleCreateBlockedSlot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (selectedCourts.length === 0) {
      toast.error("Veuillez sélectionner au moins un terrain");
      return;
    }

    const formData = new FormData(e.currentTarget);

    const baseData = {
      date: formData.get("date") as string,
      start_time: formData.get("startTime") as string,
      end_time: formData.get("endTime") as string,
      reason: formData.get("reason") as string,
      created_by: user?.id,
    };

    // Créer un blocage pour chaque terrain sélectionné
    const blocksToInsert = selectedCourts.map(courtId => ({
      ...baseData,
      court_id: courtId,
    }));

    const { error, data: insertedData } = await supabase.from("blocked_slots").insert(blocksToInsert).select();

    if (error) {
      toast.error("Erreur lors de la création");
    } else {
      // Logger la création des blocages
      for (const courtId of selectedCourts) {
        const court = courts.find((c) => c.id === courtId);
        await logAuditAction(
          "CREATE",
          "BLOCKED_SLOT",
          insertedData?.[0]?.id || null,
          null,
          { date: baseData.date, court: court?.name, reason: baseData.reason, start_time: baseData.start_time, end_time: baseData.end_time },
          `Création blocage: ${court?.name} le ${baseData.date}`
        );
      }

      toast.success(`${selectedCourts.length} terrain(s) bloqué(s) avec succès`);
      setSelectedCourts([]);
      fetchData();
      (e.target as HTMLFormElement).reset();
    }
  };

  const filteredMembers = members.filter((member) => {
    const fullName = member.full_name.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const filteredReservations = reservations.filter((res) => {
    // Filtre par nom de joueur
    const playerNames = `${res.player1?.full_name || ""} ${res.player2?.full_name || ""}`.toLowerCase();
    const matchesSearch = reservationSearchQuery === "" || 
      playerNames.includes(reservationSearchQuery.toLowerCase());
    
    // Filtre par date
    const matchesDate = reservationDateFilter === "" || 
      res.date === reservationDateFilter;
    
    // Filtre par terrain
    const matchesCourt = reservationCourtFilter === "" || 
      res.court_id === reservationCourtFilter;
    
    return matchesSearch && matchesDate && matchesCourt;
  });

  const hasReservationFilters = reservationSearchQuery || reservationDateFilter || reservationCourtFilter;

  const clearReservationFilters = () => {
    setReservationSearchQuery("");
    setReservationDateFilter("");
    setReservationCourtFilter("");
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
    <>
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
            <TabsList className="grid w-full grid-cols-5 max-w-2xl">
              <TabsTrigger value="members">Membres</TabsTrigger>
              <TabsTrigger value="reservations">Réservations</TabsTrigger>
              <TabsTrigger value="blocked">Blocages</TabsTrigger>
              <TabsTrigger value="settings">Règles</TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-1" />
                Historique
              </TabsTrigger>
            </TabsList>

          <TabsContent value="members" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestion des membres</CardTitle>
                    <CardDescription>
                      {filteredMembers.length} membre{filteredMembers.length > 1 ? "s" : ""} 
                      {searchQuery && ` (${members.length} total)`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedMembers.size > 0 && (
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteSelectedMembers}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer ({selectedMembers.size})
                      </Button>
                    )}
                    <Button 
                      variant="outline"
                      onClick={() => setBulkImportOpen(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Excel
                    </Button>
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
                            <Label htmlFor="fullName">Nom complet</Label>
                            <Input id="fullName" name="fullName" required />
                          </div>
                          <div>
                            <Label htmlFor="email">Email (optionnel)</Label>
                            <Input id="email" name="email" type="email" placeholder="Laisser vide pour auto-générer" />
                          </div>
                          <div>
                            <Label htmlFor="role">Rôle</Label>
                            <Select name="role" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez un rôle" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="player">Joueur</SelectItem>
                                <SelectItem value="elite">Elite</SelectItem>
                                <SelectItem value="coach">Coach</SelectItem>
                                <SelectItem value="super_coach">Super Coach</SelectItem>
                                <SelectItem value="admin">Administrateur</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" className="w-full">
                            Créer le membre
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par nom..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>PIN</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Date d'inscription</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedMembers.has(member.id)}
                            onCheckedChange={() => toggleMemberSelection(member.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {member.full_name}
                          {member.must_change_password && (
                            <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              Nouveau
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {member.username ? (
                            <span className="font-mono text-sm">{member.username}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.temporary_pin ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {showPins.has(member.id) ? member.temporary_pin : "••••"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePinVisibility(member.id)}
                              >
                                {showPins.has(member.id) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const role = member.user_roles?.find((r: any) => r.role !== 'player')?.role || member.user_roles?.[0]?.role || 'player';
                            return (
                              <>
                                {role}
                                {role === 'elite' && ' ⚡'}
                                {role === 'coach' && ' 🎾'}
                                {role === 'super_coach' && ' ⭐🎾'}
                              </>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMember(member);
                                setEditMemberOpen(true);
                              }}
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPin(member.id, member.full_name)}
                              title="Réinitialiser le PIN"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteMember(member.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={editMemberOpen} onOpenChange={setEditMemberOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le membre</DialogTitle>
                </DialogHeader>
                {selectedMember && (
                  <form onSubmit={handleEditMember} className="space-y-4">
                    <div>
                      <Label htmlFor="edit-fullName">Nom complet</Label>
                      <Input
                        id="edit-fullName"
                        name="fullName"
                        defaultValue={selectedMember.full_name}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        name="email"
                        type="email"
                        defaultValue={selectedMember.email}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-role">Rôle</Label>
                      <Select
                        name="role"
                        defaultValue={selectedMember.user_roles?.find((r: any) => r.role !== 'player')?.role || selectedMember.user_roles?.[0]?.role || "player"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">Joueur</SelectItem>
                          <SelectItem value="elite">Elite</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="super_coach">Super Coach</SelectItem>
                          <SelectItem value="admin">Administrateur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">
                      Enregistrer les modifications
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="reservations" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Réservations à venir</CardTitle>
                    <CardDescription>
                      {filteredReservations.length} réservation{filteredReservations.length > 1 ? "s" : ""}
                      {hasReservationFilters && ` (${reservations.length} total)`}
                    </CardDescription>
                  </div>
                  {hasReservationFilters && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={clearReservationFilters}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Effacer les filtres
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Barre de recherche et filtres */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recherche par nom */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par joueur..."
                      value={reservationSearchQuery}
                      onChange={(e) => setReservationSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Filtre par date */}
                  <div>
                    <Input
                      type="date"
                      value={reservationDateFilter}
                      onChange={(e) => setReservationDateFilter(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Filtre par terrain */}
                  <Select 
                    value={reservationCourtFilter} 
                    onValueChange={setReservationCourtFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les terrains" />
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
                    {filteredReservations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {hasReservationFilters ? "Aucune réservation ne correspond aux filtres" : "Aucune réservation à venir"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReservations.map((res) => (
                        <TableRow key={res.id}>
                          <TableCell>
                            {new Date(res.date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            {res.start_time.slice(0, 5)} - {res.end_time.slice(0, 5)}
                          </TableCell>
                          <TableCell>{res.court?.name}</TableCell>
                          <TableCell>
                            {res.player1?.full_name} & {res.player2?.full_name}
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
                      ))
                    )}
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
                        <Label htmlFor="startTime">Heure début</Label>
                        <Input id="startTime" name="startTime" type="time" required />
                      </div>
                      <div>
                        <Label htmlFor="endTime">Heure fin</Label>
                        <Input id="endTime" name="endTime" type="time" required />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Terrain(s) à bloquer</Label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="all-courts" 
                            checked={selectedCourts.length === courts.length && courts.length > 0}
                            onCheckedChange={(checked) => toggleAllCourts(checked as boolean)}
                          />
                          <Label htmlFor="all-courts" className="font-medium cursor-pointer">
                            Tous les terrains
                          </Label>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pl-4">
                          {courts.map((court) => (
                            <div key={court.id} className="flex items-center gap-2">
                              <Checkbox 
                                id={`court-${court.id}`}
                                checked={selectedCourts.includes(court.id)}
                                onCheckedChange={() => toggleCourtSelection(court.id)}
                              />
                              <Label htmlFor={`court-${court.id}`} className="cursor-pointer">
                                {court.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="reason">Raison</Label>
                      <Textarea id="reason" name="reason" required />
                    </div>
                    <Button type="submit" disabled={selectedCourts.length === 0}>
                      <Ban className="h-4 w-4 mr-2" />
                      Bloquer {selectedCourts.length > 0 ? `${selectedCourts.length} terrain(s)` : "les créneaux"}
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

          <BlockedSlotsHistory />
        </div>
      </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ReservationSettingsTab 
              courts={courts} 
              userId={user?.id} 
              userProfile={userProfile} 
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <AuditLogViewer />
          </TabsContent>
          </Tabs>
        </main>
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={fetchData}
      />
    </>
  );
};

export default Admin;
