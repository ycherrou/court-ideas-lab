import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [resolvedForUserId, setResolvedForUserId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      setResolvedForUserId(undefined);
      return;
    }

    setLoading(true);

    const fetchRole = async () => {
      try {
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
        } else {
          setIsAdmin(!!data);
        }
        setResolvedForUserId(userId);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error("Erreur lors du chargement du rôle utilisateur:", error);
        setIsAdmin(false);
        setResolvedForUserId(userId);
        setLoading(false);
      }
    };

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Consider still loading if the resolved role does not match the current userId yet.
  // This prevents a race where a stale "not admin" flashes when userId changes.
  const effectiveLoading = loading || (!!userId && resolvedForUserId !== userId);

  return { isAdmin, loading: effectiveLoading };
};
