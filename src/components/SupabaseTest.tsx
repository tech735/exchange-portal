import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function SupabaseTest() {
  const [status, setStatus] = useState('Loading...');
  const [details, setDetails] = useState([]);

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('Testing Supabase connection...');
        console.log('URL:', supabaseUrl);
        console.log('Key exists:', !!supabaseAnonKey);

        if (!supabaseUrl || !supabaseAnonKey) {
          setStatus('❌ Missing Supabase configuration');
          setDetails(['Check .env file for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY']);
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const results = [];

        // Test profiles table
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (profilesError) {
          results.push(`❌ Profiles table: ${profilesError.message}`);
        } else {
          results.push('✅ Profiles table accessible');
        }

        // Test auth
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (authError) {
          results.push(`❌ Auth: ${authError.message}`);
        } else {
          results.push('✅ Auth service working');
        }

        setDetails(results);
        setStatus('✅ Connection test complete');

      } catch (error) {
        setStatus(`❌ Error: ${error.message}`);
        setDetails([error.toString()]);
      }
    }

    testConnection();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Supabase Connection Test</h2>
      <p><strong>Status:</strong> {status}</p>
      <ul>
        {details.map((detail, index) => (
          <li key={index}>{detail}</li>
        ))}
      </ul>
    </div>
  );
}
