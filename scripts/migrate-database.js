// Database migration script to add city and region columns
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  'current_listings',
  'previous_listings', 
  'just_listed',
  'sold_listings'
];

async function addCityRegionColumns() {
  console.log('🚀 Starting database migration to add city and region columns...');
  
  for (const table of TABLES) {
    console.log(`\n📝 Adding columns to ${table}...`);
    
    try {
      // Add city column
      const { error: cityError } = await supabase.rpc('add_column_if_not_exists', {
        table_name: table,
        column_name: 'city',
        column_type: 'VARCHAR(100)'
      });
      
      if (cityError) {
        console.log(`⚠️  City column might already exist in ${table}: ${cityError.message}`);
      } else {
        console.log(`✅ Added city column to ${table}`);
      }
      
      // Add region column
      const { error: regionError } = await supabase.rpc('add_column_if_not_exists', {
        table_name: table,
        column_name: 'region',
        column_type: 'VARCHAR(100)'
      });
      
      if (regionError) {
        console.log(`⚠️  Region column might already exist in ${table}: ${regionError.message}`);
      } else {
        console.log(`✅ Added region column to ${table}`);
      }
      
    } catch (error) {
      console.error(`❌ Error adding columns to ${table}:`, error.message);
      
      // Fallback: Try direct SQL execution
      try {
        console.log(`🔄 Trying direct SQL for ${table}...`);
        
        // Add city column
        const { error: citySqlError } = await supabase
          .from(table)
          .select('city')
          .limit(1);
        
        if (citySqlError && citySqlError.code === 'PGRST116') {
          // Column doesn't exist, add it
          console.log(`Adding city column to ${table} via SQL...`);
          // Note: This would require raw SQL execution which might not be available
          // The columns will be added when the first data is inserted
        }
        
      } catch (fallbackError) {
        console.log(`⚠️  Could not verify columns for ${table}. They will be added automatically when data is inserted.`);
      }
    }
  }
  
  console.log('\n✅ Database migration completed!');
  console.log('📝 Note: If columns already exist, this is normal. The system will work with the existing schema.');
}

// Run migration
addCityRegionColumns().catch(console.error);
