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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error("Login et mot de passe requis");
    }

    console.log(`Tentative de connexion - username reçu: "${username}" (longueur: ${username.length})`);
    const normalizedUsername = username.toLowerCase().trim();
    console.log(`Username normalisé: "${normalizedUsername}" (longueur: ${normalizedUsername.length})`);

    // Utiliser le client admin pour chercher le profil (pas soumis aux RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, must_change_password, temporary_pin, username")
      .eq("username", normalizedUsername)
      .maybeSingle();

    console.log(`Résultat recherche - Error:`, profileError);
    console.log(`Résultat recherche - Profile trouvé:`, profile ? `Oui (${profile.email})` : 'Non');

    if (profileError || !profile) {
      console.error(`Profil non trouvé pour username: "${normalizedUsername}"`);
      throw new Error("Identifiants invalides");
    }

    console.log(`Profil trouvé pour ${username}, email: ${profile.email}, temporary_pin: ${profile.temporary_pin}`);

    // Vérifier si le PIN correspond au temporary_pin
    let loginPassword = password;

    if (profile.temporary_pin && profile.temporary_pin === password) {
      console.log(`Authentification par PIN pour ${username} avec PIN correct`);

      // Générer un mot de passe temporaire fort pour satisfaire les règles de sécurité
      const tempPassword = `${password}_${crypto.randomUUID()}A!`;
      loginPassword = tempPassword;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password: tempPassword }
      );

      if (updateError) {
        console.error("Erreur mise à jour mot de passe:", updateError);
        throw new Error("Erreur lors de la connexion");
      }

      // Marquer le profil pour forcer le changement de mot de passe et invalider le PIN
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ temporary_pin: null, must_change_password: true })
        .eq("id", profile.id);

      if (profileUpdateError) {
        console.error("Erreur mise à jour du profil après login PIN:", profileUpdateError);
      }
    } else {
      console.log(`PIN incorrect ou absent pour ${username}. temporary_pin = ${profile.temporary_pin}, fourni = ${password}`);
    }

    // Authentifier avec email et mot de passe (PIN ou mot de passe temporaire fort)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: loginPassword,
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
