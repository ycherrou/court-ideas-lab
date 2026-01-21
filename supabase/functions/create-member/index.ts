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
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, fullName, role } = await req.json()

    // Helper functions
    const normalizeString = (str: string): string => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    }

    const generateLogin = (fullName: string): string => {
      const normalized = normalizeString(fullName)
      const parts = normalized.split(/\s+/).filter(p => p.length > 0)
      
      if (parts.length === 0) return 'user' + Math.floor(Math.random() * 10000)
      if (parts.length === 1) return parts[0]
      
      const firstName = parts[0]
      const lastName = parts[parts.length - 1]
      return firstName.charAt(0) + lastName
    }

    const generatePIN = (): string => {
      return Math.floor(1000 + Math.random() * 9000).toString()
    }

    const generateEmail = (login: string): string => {
      return `${login}@tennis-club.local`
    }

    // Valider le rôle
    const validRoles = ['player', 'admin', 'coach', 'super_coach']
    if (role && !validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate login and PIN
    const login = generateLogin(fullName)
    const pin = generatePIN()
    const generatedEmail = email || generateEmail(login)
    const temporaryPassword = `temp_${pin}_${Date.now()}`

    // Create user with admin client
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: generatedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      }
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update profile with username, PIN, and must_change_password flag
    if (data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          username: login,
          temporary_pin: pin,
          must_change_password: true
        })
        .eq('id', data.user.id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }

      // Toujours assigner un rôle (par défaut 'player' si non spécifié)
      const roleToAssign = role || 'player'
      
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: roleToAssign
        })

      if (roleError) {
        console.error('Error assigning role:', roleError)
      }

      // Logger la création du membre pour l'audit
      try {
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        await supabaseAdmin.rpc('log_action', {
          _performed_by: user.id,
          _performer_name: adminProfile?.full_name || 'Admin',
          _action_type: 'CREATE',
          _entity_type: 'MEMBER',
          _entity_id: data.user.id,
          _old_values: null,
          _new_values: { full_name: fullName, role: roleToAssign, login },
          _description: `Création membre: ${fullName} (${roleToAssign})`
        })
      } catch (auditError) {
        console.error('Error logging audit:', auditError)
      }
    }

    return new Response(JSON.stringify({ 
      data, 
      credentials: { 
        login, 
        pin,
        email: generatedEmail
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Une erreur est survenue'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
