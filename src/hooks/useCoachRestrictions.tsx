import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCoachRestrictions = (userId: string | undefined) => {
  const [isCoach, setIsCoach] = useState(false);
  const [isSuperCoach, setIsSuperCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowedCourtIds, setAllowedCourtIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setIsCoach(false);
      setIsSuperCoach(false);
      setLoading(true);
      return;
    }

    const fetchRole = async () => {
      // Vérifier si coach ou super_coach
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["coach", "super_coach"]);

      const coachRole = roles?.find((r) => r.role === "coach");
      const superCoachRole = roles?.find((r) => r.role === "super_coach");

      setIsCoach(!!coachRole);
      setIsSuperCoach(!!superCoachRole);

      // Si coach (pas super coach), récupérer les terrains autorisés
      if (coachRole && !superCoachRole) {
        const { data: courts } = await supabase
          .from("courts")
          .select("id")
          .or("court_number.in.(5,6,7,8,9),is_central.eq.true");

        setAllowedCourtIds(courts?.map((c) => c.id) || []);
      } else {
        setAllowedCourtIds([]); // Pas de restriction
      }

      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  return { isCoach, isSuperCoach, allowedCourtIds, loading };
};
