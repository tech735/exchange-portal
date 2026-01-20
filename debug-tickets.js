// Debug script to check ticket stages in database
import { createClient } from '@supabase/supabase-js';

// Read environment variables from .env file
const supabaseUrl = 'https://krganrlvkxghgmztcong.supabase.co';
const supabaseKey = 'sb_publishable_9SNoYXeMXzRoRkJ0pTxNYA_yVc_omDS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTickets() {
  try {
    console.log('Checking ticket stages...');
    
    // Get all tickets with their stages
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('id, order_id, stage, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching tickets:', error);
      return;
    }
    
    console.log('Recent tickets:');
    console.table(tickets);
    
    // Check distinct stages
    const { data: stages, error: stagesError } = await supabase
      .from('tickets')
      .select('stage')
      .not('stage', 'is', null);
    
    if (stagesError) {
      console.error('Error fetching stages:', stagesError);
      return;
    }
    
    const uniqueStages = [...new Set(stages.map(s => s.stage))];
    console.log('Available stages:', uniqueStages);
    
    // Check for invoicing-related stages
    const invoicingStages = ['EXCHANGE_COMPLETED', 'INVOICING_PENDING', 'TO_BE_REFUNDED'];
    const { data: invoicingTickets, error: invoicingError } = await supabase
      .from('tickets')
      .select('id, order_id, stage, status')
      .in('stage', invoicingStages);
    
    if (invoicingError) {
      console.error('Error fetching invoicing tickets:', invoicingError);
      return;
    }
    
    console.log(`Found ${invoicingTickets.length} tickets with invoicing stages:`);
    console.table(invoicingTickets);
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugTickets();
