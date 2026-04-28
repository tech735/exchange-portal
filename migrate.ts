import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

let env = '';
try { env = fs.readFileSync('.env', 'utf8'); } catch (e) {}
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1] : '';
const key = keyMatch ? keyMatch[1] : '';

const client = createClient(url, key);

async function migrate() {
  const { error } = await client.rpc('exec_sql', { sql_string: 'ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS customer_email TEXT;' });
  if (error) {
    console.log("RPC failed, maybe exec_sql doesn't exist.", error);
    // Alternatively, we can just use the supabase CLI if it's installed.
  } else {
    console.log("Success");
  }
}
migrate();
