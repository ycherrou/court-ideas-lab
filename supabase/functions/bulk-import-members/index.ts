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
      throw new Error("Accès réservé aux administrateurs");
    }

    const { members } = await req.json();

    if (!Array.isArray(members) || members.length === 0) {
      throw new Error("Aucun membre à importer");
    }

    if (members.length > 1000) {
      throw new Error("Maximum 1000 membres par import");
    }

    console.log(`Début de l'import de ${members.length} membres`);

    // Fonction de normalisation
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    // Fonction de génération de login
    const generateLogin = (firstName: string, lastName: string, existingLogins: Set<string>): string => {
      const normalizedFirst = normalizeString(firstName);
      const normalizedLast = normalizeString(lastName);
      
      if (!normalizedFirst || !normalizedLast) {
        throw new Error(`Nom invalide: ${firstName} ${lastName}`);
      }

      let baseLogin = `${normalizedFirst[0]}${normalizedLast}`;
      let login = baseLogin;
      let counter = 2;

      while (existingLogins.has(login)) {
        login = `${baseLogin}${counter}`;
        counter++;
      }

      existingLogins.add(login);
      return login;
    };

    // Fonction de génération de PIN
    const generatePIN = (): string => {
      return Math.floor(1000 + Math.random() * 9000).toString();
    };

    // Récupérer tous les logins existants
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("username");

    const existingLogins = new Set<string>(
      (existingProfiles || []).map(p => p.username).filter(Boolean)
    );

    const success: Array<{
      login: string;
      pin: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    }> = [];

    const errors: Array<{
      index: number;
      firstName: string;
      lastName: string;
      error: string;
    }> = [];

    // Traiter chaque membre
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      
      try {
        const firstName = member.firstName?.trim();
        const lastName = member.lastName?.trim();
        const role = member.role || 'player';
        
        if (!firstName || !lastName) {
          throw new Error("Prénom et nom requis");
        }

        // Générer login et PIN
        const login = generateLogin(firstName, lastName, existingLogins);
        const pin = generatePIN();

        // Générer email si non fourni
        const email = member.email?.trim() || `${login}@tennisclub.local`;

        console.log(`Création du membre ${i + 1}/${members.length}: ${login}`);

        // Créer l'utilisateur
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: pin,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });

        if (createError) {
          throw createError;
        }

        if (!newUser.user) {
          throw new Error("Échec de création de l'utilisateur");
        }

        // Assigner le rôle
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: newUser.user.id,
            role: role,
          });

        if (roleError) {
          console.error(`Erreur rôle pour ${login}:`, roleError);
        }

        // Mettre à jour le profil avec username, PIN et must_change_password
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            username: login,
            temporary_pin: pin,
            must_change_password: true,
          })
          .eq("id", newUser.user.id);

        if (profileError) {
          console.error(`Erreur profil pour ${login}:`, profileError);
        }

        success.push({
          login,
          pin,
          firstName,
          lastName,
          email,
          role,
        });

      } catch (error) {
        console.error(`Erreur membre ${i + 1}:`, error);
        errors.push({
          index: i + 1,
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    console.log(`Import terminé: ${success.length} réussites, ${errors.length} erreurs`);

    return new Response(
      JSON.stringify({
        success,
        errors,
        summary: {
          total: members.length,
          succeeded: success.length,
          failed: errors.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erreur globale:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
