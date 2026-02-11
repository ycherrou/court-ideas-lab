import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCoachRestrictions = (userId: string | undefined) => {
  const [isCoach, setIsCoach] = useState(false);
  const [isSuperCoach, setIsSuperCoach] = useState(false);
  const [isElite, setIsElite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowedCourtIds, setAllowedCourtIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setIsCoach(false);
      setIsSuperCoach(false);
      setIsElite(false);
      setLoading(true);
      return;
    }

    const fetchRole = async () => {
      // Vérifier si coach, super_coach ou elite
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["coach", "super_coach", "elite"]);

      const coachRole = roles?.find((r) => r.role === "coach");
      const superCoachRole = roles?.find((r) => r.role === "super_coach");
      const eliteRole = roles?.find((r) => r.role === "elite");

      setIsCoach(!!coachRole);
      setIsSuperCoach(!!superCoachRole);
      setIsElite(!!eliteRole);

      // Déterminer le rôle principal
      const roleOrder = ["super_coach", "coach", "elite"];
      const primaryRole = roles
        ?.map((r) => r.role)
        .sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b))[0];

      if (primaryRole) {
        // Lire les terrains autorisés depuis reservation_settings
        const { data: setting } = await supabase
          .from("reservation_settings")
          .select("allowed_courts")
          .eq("role", primaryRole)
          .single();

        const allowedCourts = (setting as any)?.allowed_courts as number[] | null;

        if (allowedCourts && allowedCourts.length > 0) {
          // Convertir les numéros de terrain en IDs
          const { data: courtsData } = await supabase
            .from("courts")
            .select("id, court_number, is_central");

          const ids = courtsData
            ?.filter((c) => allowedCourts.includes(c.is_central ? 10 : c.court_number))
            .map((c) => c.id) || [];

          setAllowedCourtIds(ids);
        } else {
          setAllowedCourtIds([]); // Pas de restriction
        }
      } else {
        setAllowedCourtIds([]);
      }

      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  return { isCoach, isSuperCoach, isElite, allowedCourtIds, loading };
};
