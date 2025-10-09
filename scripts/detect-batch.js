#!/usr/bin/env node

// Batch detection script to avoid database timeouts
// Usage: node scripts/detect-batch.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://idbyrtwdeeruiutoukct.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko'
);

const BATCH_SIZE = 100; // Process in smaller batches

async function detectInBatches() {
  console.log('🔍 Starting batch detection to avoid timeouts...');
  
  try {
    // Get current listings count
    const { count: currentCount } = await supabase
      .from('current_listings')
      .select('*', { count: 'exact', head: true });
    
    const { count: prevCount } = await supabase
      .from('previous_listings')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Current: ${currentCount}, Previous: ${prevCount}`);
    
    if (currentCount === 0) {
      console.log('⚠️  No current listings to process');
      return;
    }
    
    if (prevCount === 0) {
      console.log('⚠️  No previous listings - this is likely the first run');
      console.log('💡 All current listings will be considered "just-listed"');
      
      // Get all current listings and mark them as just-listed
      const { data: currentListings } = await supabase
        .from('current_listings')
        .select('*');
      
      if (currentListings && currentListings.length > 0) {
        console.log(`📦 Storing ${currentListings.length} listings as just-listed...`);
        
        const { error } = await supabase
          .from('just_listed')
          .upsert(currentListings, { onConflict: 'zpid' });
        
        if (error) throw error;
        console.log(`✅ Stored ${currentListings.length} just-listed listings`);
      }
      return;
    }
    
    // Process in batches to avoid timeout
    let offset = 0;
    let allJustListed = [];
    let allSoldListings = [];
    
    // Get all current ZPIDs first (smaller query)
    const { data: currentZpids } = await supabase
      .from('current_listings')
      .select('zpid');
    
    if (!currentZpids) {
      console.log('❌ No current ZPIDs found');
      return;
    }
    
    const currentZpidSet = new Set(currentZpids.map(l => l.zpid));
    console.log(`📊 Current ZPIDs: ${currentZpidSet.size}`);
    
    // Process previous listings in batches
    while (offset < prevCount) {
      console.log(`\n📦 Processing previous listings batch ${Math.floor(offset / BATCH_SIZE) + 1}...`);
      
      const { data: prevBatch } = await supabase
        .from('previous_listings')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (!prevBatch || prevBatch.length === 0) break;
      
      // Find sold listings (in previous but not in current)
      const soldInBatch = prevBatch.filter(listing => !currentZpidSet.has(listing.zpid));
      allSoldListings.push(...soldInBatch);
      
      console.log(`   Found ${soldInBatch.length} sold listings in this batch`);
      
      offset += BATCH_SIZE;
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Find just-listed (in current but not in previous)
    console.log('\n🔍 Finding just-listed listings...');
    
    // Get all previous ZPIDs
    const { data: prevZpids } = await supabase
      .from('previous_listings')
      .select('zpid');
    
    if (prevZpids) {
      const prevZpidSet = new Set(prevZpids.map(l => l.zpid));
      
      // Get current listings that are not in previous
      const { data: currentListings } = await supabase
        .from('current_listings')
        .select('*');
      
      if (currentListings) {
        const justListed = currentListings.filter(listing => !prevZpidSet.has(listing.zpid));
        allJustListed = justListed;
        console.log(`📊 Found ${justListed.length} just-listed listings`);
      }
    }
    
    // Store results
    console.log('\n📦 Storing results...');
    
    if (allJustListed.length > 0) {
      console.log(`📦 Storing ${allJustListed.length} just-listed listings...`);
      const { error: justListedError } = await supabase
        .from('just_listed')
        .upsert(allJustListed, { onConflict: 'zpid' });
      
      if (justListedError) throw justListedError;
      console.log(`✅ Stored ${allJustListed.length} just-listed listings`);
    }
    
    if (allSoldListings.length > 0) {
      console.log(`📦 Storing ${allSoldListings.length} sold listings...`);
      const { error: soldError } = await supabase
        .from('sold_listings')
        .upsert(allSoldListings, { onConflict: 'zpid' });
      
      if (soldError) throw soldError;
      console.log(`✅ Stored ${allSoldListings.length} sold listings`);
    }
    
    console.log('\n📈 DETECTION RESULTS:');
    console.log(`   - Just-listed: ${allJustListed.length}`);
    console.log(`   - Sold: ${allSoldListings.length}`);
    
    // Show sample results
    if (allJustListed.length > 0) {
      console.log('\n📋 Sample just-listed properties:');
      allJustListed.slice(0, 3).forEach((listing, index) => {
        console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - ${listing.addresscity} ($${listing.unformattedprice || listing.price})`);
      });
    }
    
    if (allSoldListings.length > 0) {
      console.log('\n📋 Sample sold properties:');
      allSoldListings.slice(0, 3).forEach((listing, index) => {
        console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - ${listing.addresscity} ($${listing.unformattedprice || listing.price})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in batch detection:', error.message);
    throw error;
  }
}

// Run the detection
detectInBatches().catch(console.error);
