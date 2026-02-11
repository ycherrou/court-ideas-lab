import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { ReservationSetting } from "@/hooks/useReservationSettings";

const ROLE_LABELS: Record<string, string> = {
  player: "Joueur",
  elite: "Elite ⚡",
  coach: "Coach 🎾",
  super_coach: "Super Coach ⭐🎾",
  admin: "Administrateur",
};

const ROLE_ORDER = ["player", "elite", "coach", "super_coach", "admin"];

interface Props {
  courts: { id: string; court_number: number; name: string; is_central: boolean }[];
  userId?: string;
  userProfile?: { full_name: string } | null;
}

export const ReservationSettingsTab = ({ courts, userId, userProfile }: Props) => {
  const [settings, setSettings] = useState<ReservationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("reservation_settings").select("*");
    if (data) {
      setSettings(data as unknown as ReservationSetting[]);
    }
    setLoading(false);
  };

  const sortedSettings = ROLE_ORDER.map((role) =>
    settings.find((s) => s.role === role)
  ).filter(Boolean) as ReservationSetting[];

  const updateSetting = (role: string, field: keyof ReservationSetting, value: any) => {
    setSettings((prev) =>
      prev.map((s) => (s.role === role ? { ...s, [field]: value } : s))
    );
  };

  const toggleCourt = (role: string, courtNumber: number, currentCourts: number[] | null) => {
    const current = currentCourts || [];
    const updated = current.includes(courtNumber)
      ? current.filter((c) => c !== courtNumber)
      : [...current, courtNumber];
    updateSetting(role, "allowed_courts", updated.length > 0 ? updated.sort((a, b) => a - b) : null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from("reservation_settings")
          .update({
            max_active: setting.max_active,
            max_hours_per_day: setting.max_hours_per_day,
            allowed_courts: setting.allowed_courts,
            can_create: setting.can_create,
          } as any)
          .eq("role", setting.role as any);

        if (error) throw error;
      }

      // Log audit
      if (userId) {
        try {
          await supabase.rpc("log_action", {
            _performed_by: userId,
            _performer_name: userProfile?.full_name || "Inconnu",
            _action_type: "UPDATE",
            _entity_type: "RESERVATION_SETTINGS",
            _entity_id: null,
            _old_values: null,
            _new_values: JSON.parse(JSON.stringify(Object.fromEntries(settings.map((s) => [s.role, s])))),
            _description: "Modification des règles de réservation",
          });
        } catch (e) {
          console.error("Erreur audit:", e);
        }
      }

      toast.success("Règles de réservation enregistrées");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;

  // Get all court numbers for the selector
  const courtOptions = courts
    .map((c) => ({ number: c.is_central ? 10 : c.court_number, name: c.name }))
    .sort((a, b) => a.number - b.number);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Règles de réservation</CardTitle>
            <CardDescription>Configurez les quotas et restrictions par rôle</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedSettings.map((setting) => (
            <Card key={setting.role} className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{ROLE_LABELS[setting.role] || setting.role}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Max active */}
                  <div className="space-y-2">
                    <Label>Réservations actives max</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={setting.max_active ?? ""}
                        placeholder="Illimité"
                        onChange={(e) =>
                          updateSetting(
                            setting.role,
                            "max_active",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        {setting.max_active === null ? "(Illimité)" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Max hours per day */}
                  <div className="space-y-2">
                    <Label>Heures max / jour</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={setting.max_hours_per_day ?? ""}
                        placeholder="Illimité"
                        onChange={(e) =>
                          updateSetting(
                            setting.role,
                            "max_hours_per_day",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        {setting.max_hours_per_day === null ? "(Illimité)" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Can create */}
                  <div className="space-y-2">
                    <Label>Peut créer des réservations</Label>
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={setting.can_create}
                        onCheckedChange={(checked) =>
                          updateSetting(setting.role, "can_create", checked)
                        }
                      />
                      <span className="text-sm">{setting.can_create ? "Oui" : "Non"}</span>
                    </div>
                  </div>
                </div>

                {/* Allowed courts */}
                <div className="space-y-2">
                  <Label>Terrains autorisés</Label>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`all-courts-${setting.role}`}
                        checked={setting.allowed_courts === null}
                        onCheckedChange={(checked) =>
                          updateSetting(setting.role, "allowed_courts", checked ? null : [])
                        }
                      />
                      <Label htmlFor={`all-courts-${setting.role}`} className="cursor-pointer font-medium">
                        Tous
                      </Label>
                    </div>
                    {setting.allowed_courts !== null &&
                      courtOptions.map((court) => (
                        <div key={court.number} className="flex items-center gap-2">
                          <Checkbox
                            id={`court-${setting.role}-${court.number}`}
                            checked={(setting.allowed_courts || []).includes(court.number)}
                            onCheckedChange={() =>
                              toggleCourt(setting.role, court.number, setting.allowed_courts)
                            }
                          />
                          <Label
                            htmlFor={`court-${setting.role}-${court.number}`}
                            className="cursor-pointer text-sm"
                          >
                            {court.name}
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
