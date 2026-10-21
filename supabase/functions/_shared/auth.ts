// @ts-nocheck
// Caller checks for Edge Functions.
//
// The anon key ships in the frontend bundle, so a request that merely carries a valid
// JWT proves nothing. Each function states who may call it:
//   'service' — cron jobs / DB triggers, which send the service role key
//   'staff'   — a signed-in user with a row in public.profiles (or the service role)
//   'admin'   — a signed-in user whose profile role is ADMIN
//
// Returns null when the caller is allowed, otherwise a 401/403 Response to return as is.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

type Level = 'service' | 'staff' | 'admin';

function bearer(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function deny(status: number, error: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}

// The vault copy used by cron may be a different key format from the function's env
// copy, so a token that does not match exactly is confirmed by making a service-role
// only call with it.
async function isServiceRole(token: string, supabaseUrl: string): Promise<boolean> {
  const known = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), Deno.env.get('SERVICE_ROLE_KEY')];
  if (known.some((key) => key && key === token)) return true;

  const client = createClient(supabaseUrl, token, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}

export async function requireCaller(
  req: Request,
  level: Level,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const token = bearer(req);
  if (!token) return deny(401, 'Not signed in', corsHeaders);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return deny(500, 'Supabase service credentials not configured', corsHeaders);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // A user session is the common case from the app; try it first.
  const { data: userData } = await admin.auth.getUser(token);
  if (userData?.user) {
    if (level === 'service') return deny(403, 'Not allowed', corsHeaders);

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!profile) return deny(403, 'No staff profile for this account', corsHeaders);
    if (level === 'admin' && profile.role?.toUpperCase() !== 'ADMIN') {
      return deny(403, 'Admin access required', corsHeaders);
    }
    return null;
  }

  if (level !== 'admin' && (await isServiceRole(token, supabaseUrl))) return null;

  return deny(401, 'Not signed in', corsHeaders);
}
