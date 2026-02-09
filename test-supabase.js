import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration');
} else {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Test connection by checking if profiles table exists
  supabase
    .from('profiles')
    .select('count')
    .then(({ data, error }) => {
      if (error) {
        console.error('Profiles table error:', error);
      } else {
        console.log('✅ Profiles table accessible');
      }
    });
}
