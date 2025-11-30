import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      console.error('User is not admin')
      return new Response(JSON.stringify({ error: 'Accès non autorisé - Admin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { members } = await req.json()

    if (!Array.isArray(members)) {
      return new Response(JSON.stringify({ error: 'Format invalide: members doit être un tableau' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (members.length === 0) {
      return new Response(JSON.stringify({ error: 'Aucun membre à importer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (members.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 membres par import' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Starting import of ${members.length} members...`)

    // Fonction helper pour normaliser les chaînes
    const normalizeString = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };

    // Fonction pour générer un login à partir du nom complet
    const generateLogin = (fullName: string, existingUsernames: Set<string>): string => {
      const normalized = normalizeString(fullName);
      const words = normalized.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length === 0) {
        // Fallback si le nom est vide ou invalide
        let baseLogin = 'user';
        let counter = 1;
        let login = baseLogin;
        while (existingUsernames.has(login)) {
          login = `${baseLogin}${counter}`;
          counter++;
        }
        return login;
      }

      // Prendre la première lettre du premier mot + le reste des mots
      const firstLetter = words[0][0];
      const restOfName = words.slice(1).join('');
      
      let baseLogin = firstLetter + restOfName;
      
      // S'assurer que le login est unique
      let login = baseLogin;
      let counter = 1;
      while (existingUsernames.has(login)) {
        login = `${baseLogin}${counter}`;
        counter++;
      }
      
      return login;
    };

    // Fonction pour générer un PIN de 4 chiffres
    const generatePIN = (): string => {
      return Math.floor(1000 + Math.random() * 9000).toString();
    };

    // Récupérer tous les usernames existants
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('username');
    
    const existingUsernames = new Set(
      existingProfiles?.map(p => p.username).filter(Boolean) || []
    );

    const validRoles = ['player', 'admin', 'coach', 'super_coach'];
    const results = [];
    const errors = [];

    for (const member of members) {
      try {
        const { fullName, email, role } = member;

        // Validation
        if (!fullName || fullName.trim() === '') {
          errors.push({
            fullName: fullName || 'Non spécifié',
            email: email || 'Non spécifié',
            error: 'Le nom complet est requis'
          });
          continue;
        }

        // Valider le rôle
        const assignedRole = role && validRoles.includes(role.toLowerCase()) 
          ? role.toLowerCase() 
          : 'player';

        // Générer login et PIN
        const login = generateLogin(fullName, existingUsernames);
        existingUsernames.add(login); // Ajouter à la liste pour éviter les doublons
        const pin = generatePIN();

        // Créer l'utilisateur avec un mot de passe temporaire fort
        const tempPassword = `Temp${pin}${crypto.randomUUID()}!`;
        
        const userEmail = email && email.trim() !== '' 
          ? email 
          : `${login}@tempmail.com`;

        console.log(`Creating user: ${login} (${fullName}) with email ${userEmail}`);

        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          }
        });

        if (userError) {
          console.error(`Error creating user ${login}:`, userError);
          errors.push({
            fullName,
            email: userEmail,
            error: userError.message
          });
          continue;
        }

        if (!userData.user) {
          console.error(`No user data returned for ${login}`);
          errors.push({
            fullName,
            email: userEmail,
            error: 'Aucune donnée utilisateur retournée'
          });
          continue;
        }

        // Mettre à jour le profil avec le username et le PIN
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            username: login,
            temporary_pin: pin,
            must_change_password: true
          })
          .eq('id', userData.user.id);

        if (profileError) {
          console.error(`Error updating profile for ${login}:`, profileError);
          // On continue quand même car l'utilisateur est créé
        }

        // Assigner le rôle
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userData.user.id);

        if (roleError) {
          console.error(`Error deleting existing roles for ${login}:`, roleError);
        }

        const { error: insertRoleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userData.user.id,
            role: assignedRole
          });

        if (insertRoleError) {
          console.error(`Error assigning role for ${login}:`, insertRoleError);
        }

        console.log(`Successfully created user: ${login} with role ${assignedRole}`);

        results.push({
          login,
          pin,
          fullName,
          email: userEmail,
          role: assignedRole
        });

      } catch (error) {
        console.error('Error processing member:', error);
        errors.push({
          fullName: member.fullName || 'Inconnu',
          email: member.email || 'Non spécifié',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }

    console.log(`Import completed: ${results.length} success, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: results,
        errors: errors,
        summary: {
          total: members.length,
          successful: results.length,
          failed: errors.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Global error:', error);
    const message = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
