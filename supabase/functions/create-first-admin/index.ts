import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { username, password, fullName, email } = await req.json()

    if (!username || !password || !fullName || !email) {
      return new Response(JSON.stringify({ error: 'Tous les champs sont requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Création du compte admin: ${email}`)

    // Générer un PIN à 4 chiffres
    const pin = Math.floor(1000 + Math.random() * 9000).toString()

    // Créer l'utilisateur avec l'API admin
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      }
    })

    if (createError) {
      console.error('Erreur création utilisateur:', createError)
      throw createError
    }

    console.log(`Utilisateur créé: ${userData.user?.id}`)

    // Mettre à jour le profil avec username et PIN
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        username: username.toLowerCase(),
        temporary_pin: pin,
        must_change_password: true
      })
      .eq('id', userData.user!.id)

    if (profileError) {
      console.error('Erreur mise à jour profil:', profileError)
      throw profileError
    }

    console.log(`Profil mis à jour avec username: ${username}`)

    // Assigner le rôle admin
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user!.id,
        role: 'admin'
      })

    if (roleError) {
      console.error('Erreur assignation rôle:', roleError)
      throw roleError
    }

    console.log('Rôle admin assigné')

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: userData.user!.id,
        email,
        username,
        pin,
        fullName
      },
      message: `Admin créé avec succès. Login: ${username}, PIN: ${pin}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Erreur:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Une erreur est survenue'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
