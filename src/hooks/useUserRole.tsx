import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    if (!userId) {
      // Pas d'utilisateur encore disponible: rester en chargement pour éviter des redirections prématurées
      setIsAdmin(false);
      setLoading(true);
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
          // En cas d'erreur réseau/permission ponctuelle, éviter de conclure "non admin" trop vite
          // On laisse le loader actif et on retente une fois rapidement.
          setTimeout(() => {
            if (!cancelled) fetchRole();
          }, 300);
          return;
        }

        setIsAdmin(!!data);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setTimeout(() => {
          if (!cancelled) fetchRole();
        }, 300);
      }
    };

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isAdmin, loading };
};
