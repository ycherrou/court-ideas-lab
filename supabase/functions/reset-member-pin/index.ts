import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  console.log("=== reset-member-pin function called ===");
  console.log("Method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No auth header provided");
      throw new Error("Non autorisé");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);
    
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    console.log("getUser result - user:", user?.id, "error:", userError?.message);

    if (userError || !user) {
      console.error("Auth failed:", userError?.message || "No user");
      throw new Error("Non autorisé");
    }

    // Vérifier que l'utilisateur est admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) throw new Error("Accès non autorisé");

    const body = await req.json();
    const userId: string | undefined = body?.userId;
    if (!userId) throw new Error("ID utilisateur manquant");

    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    // Récupérer les infos du membre avant maj pour l'audit
    const { data: memberBefore } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, temporary_pin")
      .eq("id", userId)
      .maybeSingle();

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ temporary_pin: newPin, must_change_password: true })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Récupérer le nom de l'admin pour l'audit
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Logger l'action (best-effort)
    try {
      await supabaseAdmin.rpc("log_action", {
        _performed_by: user.id,
        _performer_name: adminProfile?.full_name || "Admin",
        _action_type: "UPDATE",
        _entity_type: "PASSWORD",
        _entity_id: userId,
        _old_values: {
          full_name: memberBefore?.full_name,
          email: memberBefore?.email,
          temporary_pin: memberBefore?.temporary_pin,
        },
        _new_values: {
          temporary_pin: newPin,
          must_change_password: true,
        },
        _description: `Réinitialisation PIN: ${memberBefore?.full_name || "Inconnu"}`,
      });
    } catch (auditError) {
      console.error("Error logging audit:", auditError);
    }

    return new Response(JSON.stringify({ success: true, pin: newPin }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur reset-member-pin:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});