import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error("Login et mot de passe requis");
    }

    console.log(`Tentative de connexion pour: ${username}`);

    // Rechercher l'utilisateur par username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, must_change_password")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Identifiants invalides");
    }

    console.log(`Profil trouvé pour ${username}, email: ${profile.email}`);

    // Authentifier avec email et password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (authError) {
      console.error("Erreur authentification:", authError);
      throw new Error("Identifiants invalides");
    }

    console.log(`Connexion réussie pour ${username}`);

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
        mustChangePassword: profile.must_change_password || false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erreur login:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
