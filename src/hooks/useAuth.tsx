import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initialSessionChecked = useRef(false);

  useEffect(() => {
    // D'abord, vérifier la session existante
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Token invalide ou expiré - nettoyer proprement
        console.error("Session invalide, nettoyage...", error);
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      initialSessionChecked.current = true;
      setLoading(false);
    });

    // Ensuite, écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Ne mettre à jour que si la session initiale a été vérifiée
        // Cela évite les race conditions où onAuthStateChange émet avant getSession
        if (initialSessionChecked.current) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return { user, session, loading, signOut };
};
