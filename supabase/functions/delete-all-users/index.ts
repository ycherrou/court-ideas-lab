import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Récupération de tous les utilisateurs...');

    // Récupérer tous les utilisateurs
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Erreur lors de la récupération des utilisateurs:', listError);
      throw listError;
    }

    console.log(`${users.length} utilisateurs trouvés`);

    // Supprimer chaque utilisateur
    let deletedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      if (deleteError) {
        console.error(`Erreur lors de la suppression de l'utilisateur ${user.id}:`, deleteError);
        errorCount++;
      } else {
        console.log(`Utilisateur ${user.id} supprimé avec succès`);
        deletedCount++;
      }
    }

    console.log(`Suppression terminée: ${deletedCount} supprimés, ${errorCount} erreurs`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        errors: errorCount,
        total: users.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Une erreur est survenue' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
