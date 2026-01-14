// Test new database connection
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Testing New Supabase Database Connection...\n');

const supabaseUrl = "https://krganrlvkxghgmztcong.supabase.co";
const supabaseKey = "sb_publishable_9SNoYXeMXzRoRkJ0pTxNYA_yVc_omDS";

console.log('📡 Connecting to:', supabaseUrl);
console.log('🔑 Using API Key:', supabaseKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNewConnection() {
  try {
    // Test 1: Basic connection
    console.log('\n1️⃣ Testing basic connection...');
    const { data, error } = await supabase.from('product_catalog').select('count').single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ Table "product_catalog" does not exist');
        console.log('🔧 You need to run the database setup script first');
        console.log('📝 See NEW-SETUP.md for the SQL script');
      } else if (error.code === 'PGRST301') {
        console.log('❌ Invalid API key or project URL');
        console.log('🔧 Check your credentials in .env file');
      } else {
        console.log('❌ Connection failed:', error.message);
        console.log('🔧 Error code:', error.code);
      }
      return false;
    }
    
    console.log('✅ Basic connection successful!');
    
    // Test 2: Check if tickets table exists
    console.log('\n2️⃣ Checking tickets table...');
    const { data: ticketsData, error: ticketsError } = await supabase.from('tickets').select('count').single();
    
    if (ticketsError) {
      if (ticketsError.code === 'PGRST116') {
        console.log('❌ Table "tickets" does not exist');
        console.log('🔧 Run the setup script to create all tables');
      } else {
        console.log('❌ Tickets table error:', ticketsError.message);
      }
      return false;
    }
    
    console.log('✅ Tickets table exists!');
    
    // Test 3: Test ticket creation
    console.log('\n3️⃣ Testing ticket creation...');
    const testTicket = {
      order_id: 'TEST-' + Date.now(),
      customer_name: 'Connection Test',
      customer_phone: '1234567890',
      reason_code: 'WRONG_SIZE',
      return_items: [],
      exchange_items: []
    };
    
    const { data: newTicket, error: createError } = await supabase.from('tickets').insert([testTicket]);
    
    if (createError) {
      console.log('❌ Ticket creation failed:', createError.message);
      console.log('🔧 Error code:', createError.code);
      return false;
    }
    
    console.log('✅ Ticket creation works!');
    console.log('🎉 Database is fully configured and ready!');
    
    return true;
    
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    return false;
  }
}

testNewConnection().then(success => {
  if (success) {
    console.log('\n🚀 Perfect! Your database is connected and working.');
    console.log('📱 Your application should work perfectly now.');
  } else {
    console.log('\n📋 Next steps:');
    console.log('1. Verify your Supabase project is active');
    console.log('2. Check if API key is correct');
    console.log('3. Run the database setup script from NEW-SETUP.md');
    console.log('4. Test again');
  }
});
