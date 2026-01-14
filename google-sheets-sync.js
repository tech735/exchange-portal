// Google Sheets to Supabase Integration Script
// This script will sync your Google Sheets data with Supabase

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Supabase Configuration
const supabaseUrl = "https://krganrlvkxghgmztcong.supabase.co";
const supabaseKey = "sb_publishable_9SNoYXeMXzRoRkJ0pTxNYA_yVc_omDS";
const supabase = createClient(supabaseUrl, supabaseKey);

// Google Sheets Configuration
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Get from Google Sheets URL
const SHEET_NAME = 'Sheet1'; // Change to your sheet name
const RANGE = 'A:Z'; // Adjust based on your data

// Google Sheets Authentication
// You'll need to set up a service account and download the JSON key file
const auth = new google.auth.GoogleAuth({
  keyFile: './service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function syncGoogleSheetsToSupabase() {
  try {
    console.log('🔄 Starting Google Sheets to Supabase sync...');
    
    // Step 1: Get data from Google Sheets
    console.log('📊 Fetching data from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!${RANGE}`,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No data found in Google Sheets');
      return;
    }
    
    console.log(`✅ Found ${rows.length} rows in Google Sheets`);
    
    // Step 2: Transform data for Supabase
    console.log('🔄 Transforming data for Supabase...');
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const products = dataRows.map((row, index) => {
      const product = {};
      headers.forEach((header, i) => {
        // Map Google Sheets columns to Supabase fields
        switch (header.toLowerCase()) {
          case 'sku':
          case 'product id':
          case 'id':
            product.sku = row[i];
            break;
          case 'product name':
          case 'name':
          case 'product':
            product.product_name = row[i];
            break;
          case 'description':
            product.product_description = row[i];
            break;
          case 'category':
            product.category = row[i];
            break;
          case 'variants':
          case 'sizes':
            product.variants = row[i] ? JSON.parse(row[i]) : [];
            break;
          case 'school tags':
          case 'schools':
          case 'tags':
            product.school_tags = row[i] ? row[i].split(',').map(tag => tag.trim()) : [];
            break;
          case 'price':
            product.price = parseFloat(row[i]) || 0;
            break;
          case 'active':
            product.active = row[i] === 'TRUE' || row[i] === 'true' || row[i] === 1;
            break;
          default:
            product[header.toLowerCase().replace(/\s+/g, '_')] = row[i];
        }
      });
      
      return {
        ...product,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    
    console.log(`✅ Transformed ${products.length} products`);
    
    // Step 3: Sync to Supabase
    console.log('💾 Syncing to Supabase...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        // Check if product already exists
        const { data: existing } = await supabase
          .from('product_catalog')
          .select('id')
          .eq('sku', product.sku)
          .single();
        
        if (existing) {
          // Update existing product
          const { error } = await supabase
            .from('product_catalog')
            .update(product)
            .eq('sku', product.sku);
          
          if (error) throw error;
          console.log(`✅ Updated product: ${product.sku}`);
        } else {
          // Insert new product
          const { error } = await supabase
            .from('product_catalog')
            .insert(product);
          
          if (error) throw error;
          console.log(`✅ Inserted product: ${product.sku}`);
        }
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error with product ${product.sku}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 4: Log sync status
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Successfully synced: ${successCount} products`);
    console.log(`❌ Errors: ${errorCount} products`);
    console.log(`📊 Total processed: ${products.length} products`);
    
    // Update sync log in database
    await supabase.from('google_sheets_sync').insert({
      sheet_id: SPREADSHEET_ID,
      sheet_name: SHEET_NAME,
      last_sync_at: new Date().toISOString(),
      sync_status: errorCount === 0 ? 'success' : 'partial',
      total_rows: products.length,
      synced_rows: successCount,
      error_message: errorCount > 0 ? `${errorCount} products failed to sync` : null,
    });
    
    console.log('🎉 Sync completed!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    
    // Log error to database
    await supabase.from('google_sheets_sync').insert({
      sheet_id: SPREADSHEET_ID,
      sheet_name: SHEET_NAME,
      last_sync_at: new Date().toISOString(),
      sync_status: 'error',
      total_rows: 0,
      synced_rows: 0,
      error_message: error.message,
    });
  }
}

// Manual CSV Import Alternative
async function importFromCSV(filePath) {
  const fs = require('fs');
  const csv = require('csv-parser');
  
  console.log('📁 Importing from CSV file...');
  
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          // Transform and insert data
          const products = results.map(row => ({
            sku: row.sku || row['Product ID'],
            product_name: row['Product Name'] || row.name,
            product_description: row.description,
            category: row.category,
            variants: row.variants ? JSON.parse(row.variants) : [],
            school_tags: row['School Tags'] ? row['School Tags'].split(',').map(tag => tag.trim()) : [],
            price: parseFloat(row.price) || 0,
            active: row.active === 'TRUE' || row.active === 'true' || row.active === 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          
          // Insert to Supabase
          const { error } = await supabase.from('product_catalog').insert(products);
          
          if (error) throw error;
          
          console.log(`✅ Successfully imported ${products.length} products`);
          resolve(products.length);
        } catch (error) {
          console.error('❌ Import failed:', error.message);
          reject(error);
        }
      });
  });
}

// Export functions
export { syncGoogleSheetsToSupabase, importFromCSV };

// Run sync if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncGoogleSheetsToSupabase();
}
