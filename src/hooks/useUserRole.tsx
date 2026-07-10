import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    if (!userId) {
      // L'auth est gérée par useAuth ; sans utilisateur, ne pas bloquer les redirections.
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("Erreur lors du chargement du rôle utilisateur:", error);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(!!data);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error("Erreur lors du chargement du rôle utilisateur:", error);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isAdmin, loading };
};
