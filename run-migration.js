// Run database migration to create unified listings table
import { createClient } from "@supabase/supabase-js";
import fs from 'fs';

const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log(`\n${'='.repeat(60)}`);
console.log(`🗄️  DATABASE MIGRATION`);
console.log(`${'='.repeat(60)}\n`);

console.log(`⚠️  This migration will create:`);
console.log(`   - listings table (unified)`);
console.log(`   - scrape_logs table`);
console.log(`   - listing_status_history table`);
console.log(`\n`);

console.log(`❌ NOTE: Supabase JS client doesn't support running raw SQL migrations.`);
console.log(`\n📋 TO APPLY MIGRATION:\n`);
console.log(`1. Go to: https://supabase.com/dashboard/project/idbyrtwdeeruiutoukct/sql/new`);
console.log(`\n2. Copy the SQL from: migrations/create-unified-listings-table.sql`);
console.log(`\n3. Paste and run it in the Supabase SQL Editor`);
console.log(`\n4. Verify tables created successfully`);
console.log(`\n`);

console.log(`${'='.repeat(60)}\n`);

// Read and display the SQL
const sql = fs.readFileSync('migrations/create-unified-listings-table.sql', 'utf8');
console.log(`📄 SQL TO RUN:\n`);
console.log(sql);
