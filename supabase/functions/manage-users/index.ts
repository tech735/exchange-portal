/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Edge Function Error: Service role key not found.');
            throw new Error('Supabase service credentials not configured');
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { action, ...params } = await req.json();

        if (action === 'create-user') {
            const { email, password, full_name, role } = params;

            if (!email || !password || !full_name || !role) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            // [FIX] Cleanup any old mock profiles with this email first to prevent unique constraint errors
            // This is essential since we're transitioning from mock ID '0' to real UUIDs
            console.log(`Cleaning up old profiles for email: ${email}`);
            const { error: cleanupError } = await supabaseAdmin
                .from('profiles')
                .delete()
                .eq('email', email);

            if (cleanupError) {
                console.error('Profile Cleanup Error:', cleanupError);
                // We keep going, it might not exist
            }

            // 1. Create the Auth User
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name }
            });

            if (authError) {
                console.error('Auth User Creation Error:', authError);
                return new Response(JSON.stringify({ error: authError.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            const userId = authData.user.id;

            // 2. Upsert into public.profiles
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    email,
                    full_name,
                    role
                });

            if (profileError) {
                console.error('Profile Upsert Error:', profileError);
                // Attempt to cleanup auth user if profile fails
                await supabaseAdmin.auth.admin.deleteUser(userId);
                return new Response(JSON.stringify({ error: 'User created but profile setup failed: ' + profileError.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            return new Response(JSON.stringify({ success: true, user: authData.user }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (action === 'reset-password') {
            const { userId, newPassword } = params;

            if (!userId || !newPassword) {
                return new Response(JSON.stringify({ error: 'Missing userId or newPassword' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            console.log(`Resetting password for userId: ${userId}`);

            // 1. Verify user exists in Auth
            const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

            if (getUserError || !userData?.user) {
                console.error(`User ${userId} not found in Auth system:`, getUserError);
                return new Response(JSON.stringify({ 
                    error: 'This user exists in the profiles table but not in the Authentication system. Please delete and recreate this user to enable password management.' 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                });
            }

            // 2. Perform Update
            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: newPassword
            });

            if (error) {
                console.error('Password Reset Error:', error);
                return new Response(JSON.stringify({ error: error.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (action === 'delete-user') {
            const { userId } = params;

            if (!userId) {
                return new Response(JSON.stringify({ error: 'Missing userId' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            // Delete from profiles first (handled by RLS or cascading usually, but let's be explicit)
            await supabaseAdmin.from('profiles').delete().eq('id', userId);

            // Delete from auth
            const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

            if (error) {
                console.error('Delete User Error:', error);
                return new Response(JSON.stringify({ error: error.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (action === 'diagnostic') {
            console.log('Diagnostic Action Started');
            const { data, count, error } = await supabaseAdmin.from('profiles').select('*', { count: 'exact' });
            
            console.log('Profile Fetch Result:', { dataLength: data?.length, count, error });

            return new Response(JSON.stringify({ 
                counts: { 
                    profiles: count || 0,
                    error: error ? error.message : null
                },
                dataPreview: data ? data.slice(0, 2) : []
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });

    } catch (error: any) {
        console.error('Error in manage-users function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
