import { createClient } from '@supabase/supabase-js';

// Get url and key from env
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'example';

// read from .env if exists
import * as fs from 'fs';
let env = '';
try {
  env = fs.readFileSync('.env', 'utf8');
} catch (e) {}

const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const client = createClient(urlMatch ? urlMatch[1] : supabaseUrl, keyMatch ? keyMatch[1] : supabaseKey);

client.from('tickets').select('id, stage, status, is_paid').order('created_at', { ascending: false }).limit(5).then(res => console.log(JSON.stringify(res.data, null, 2)));
