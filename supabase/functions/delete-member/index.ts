import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non autorisé");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Non autorisé");
    }

    // Vérifier que l'utilisateur est admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      throw new Error("Accès non autorisé");
    }

    const body = await req.json();
    
    // Support both single userId and array of userIds
    const userIds: string[] = body.userIds || (body.userId ? [body.userId] : []);

    if (userIds.length === 0) {
      throw new Error("ID utilisateur manquant");
    }

    console.log(`Suppression de ${userIds.length} utilisateur(s)`);

    // Récupérer le nom de l'admin pour l'audit
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    // Traiter les suppressions par lots de 5 pour éviter les timeouts
    const batchSize = 5;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const deletePromises = batch.map(async (userId) => {
        try {
          // Récupérer les infos du membre avant suppression pour l'audit
          const { data: memberProfile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', userId)
            .single();

          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          
          if (deleteError) {
            console.error(`Erreur suppression ${userId}:`, deleteError.message);
            results.failed.push({ id: userId, error: deleteError.message });
          } else {
            console.log(`Utilisateur ${userId} supprimé`);
            results.success.push(userId);

            // Logger la suppression pour l'audit
            try {
              await supabaseAdmin.rpc('log_action', {
                _performed_by: user.id,
                _performer_name: adminProfile?.full_name || 'Admin',
                _action_type: 'DELETE',
                _entity_type: 'MEMBER',
                _entity_id: userId,
                _old_values: { full_name: memberProfile?.full_name, email: memberProfile?.email },
                _new_values: null,
                _description: `Suppression membre: ${memberProfile?.full_name || 'Inconnu'}`
              });
            } catch (auditError) {
              console.error('Error logging audit:', auditError);
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
          console.error(`Exception suppression ${userId}:`, errorMessage);
          results.failed.push({ id: userId, error: errorMessage });
        }
      });

      await Promise.all(deletePromises);
    }

    console.log(`Résultat: ${results.success.length} supprimé(s), ${results.failed.length} échec(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: results.success.length,
        failed: results.failed.length,
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erreur delete-member:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
