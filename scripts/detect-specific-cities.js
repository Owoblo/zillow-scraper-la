#!/usr/bin/env node

// Script to detect sold and just-listed properties for specific cities only
// Usage: node scripts/detect-specific-cities.js "Oakville,Burlington,Milwaukee"

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Table names
const CURRENT_LISTINGS_TABLE = "current_listings";
const PREVIOUS_LISTINGS_TABLE = "previous_listings";
const JUST_LISTED_TABLE = "just_listed";
const SOLD_LISTINGS_TABLE = "sold_listings";

/**
 * Detect just-listed and sold listings for specific cities only
 */
async function detectForSpecificCities(cityNames) {
  console.log(`🔍 Detecting changes for specific cities: ${cityNames.join(', ')}`);
  
  let totalJustListed = 0;
  let totalSold = 0;
  
  for (const cityName of cityNames) {
    console.log(`\n📍 Processing ${cityName}...`);
    
    try {
      // Get current listings for this specific city only
      const { data: currentListings, error: currentError } = await supabase
        .from(CURRENT_LISTINGS_TABLE)
        .select("*")
        .eq('city', cityName);
      
      if (currentError) throw currentError;

      // Get previous listings for this specific city only
      const { data: previousListings, error: prevError } = await supabase
        .from(PREVIOUS_LISTINGS_TABLE)
        .select("*")
        .eq('city', cityName);
      
      if (prevError) throw prevError;

      console.log(`📊 ${cityName}: Current=${currentListings.length}, Previous=${previousListings.length}`);
      
      if (previousListings.length === 0) {
        console.log(`⚠️  ${cityName}: No previous data - this might be the first run for this city`);
        continue;
      }

      // Create sets for efficient comparison
      const currentZpidSet = new Set(currentListings.map(l => l.zpid));
      const previousZpidSet = new Set(previousListings.map(l => l.zpid));
      
      // Find just-listed (in current but not in previous)
      const justListed = currentListings.filter(listing => !previousZpidSet.has(listing.zpid));
      
      // Find sold (in previous but not in current)
      const soldListings = previousListings.filter(listing => !currentZpidSet.has(listing.zpid));
      
      console.log(`📈 ${cityName}: ${justListed.length} just-listed, ${soldListings.length} sold`);
      
      // Store just-listed listings
      if (justListed.length > 0) {
        const { error: justListedError } = await supabase
          .from(JUST_LISTED_TABLE)
          .upsert(justListed, { onConflict: "zpid" });
        
        if (justListedError) throw justListedError;
        console.log(`✅ Stored ${justListed.length} just-listed listings for ${cityName}`);
        
        // Show sample just-listed
        console.log(`📋 Sample just-listed for ${cityName}:`);
        justListed.slice(0, 3).forEach((listing, index) => {
          console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - $${listing.unformattedprice || listing.price}`);
        });
      }
      
      // Store sold listings
      if (soldListings.length > 0) {
        const { error: soldError } = await supabase
          .from(SOLD_LISTINGS_TABLE)
          .upsert(soldListings, { onConflict: "zpid" });
        
        if (soldError) throw soldError;
        console.log(`✅ Stored ${soldListings.length} sold listings for ${cityName}`);
        
        // Show sample sold
        console.log(`📋 Sample sold for ${cityName}:`);
        soldListings.slice(0, 3).forEach((listing, index) => {
          console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - $${listing.unformattedprice || listing.price}`);
        });
      }
      
      totalJustListed += justListed.length;
      totalSold += soldListings.length;
      
    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
    }
  }
  
  return { totalJustListed, totalSold };
}

/**
 * Switch tables for next run (current becomes previous)
 */
async function switchTables() {
  console.log("\n🔄 Switching tables for next run...");
  
  try {
    // Clear previous listings table
    const { error: clearPrevError } = await supabase
      .from(PREVIOUS_LISTINGS_TABLE)
      .delete()
      .neq('zpid', ''); // Delete all records
    
    if (clearPrevError) throw clearPrevError;

    // Move current listings to previous listings
    const { data: currentListings, error: currentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select("*");
    
    if (currentError) throw currentError;

    if (currentListings.length > 0) {
      const { error: moveError } = await supabase
        .from(PREVIOUS_LISTINGS_TABLE)
        .insert(currentListings);
      
      if (moveError) throw moveError;
    }

    // Clear current listings table for next run
    const { error: clearCurrentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .delete()
      .neq('zpid', '');
    
    if (clearCurrentError) throw clearCurrentError;

    console.log("✅ Tables switched successfully");
  } catch (error) {
    console.error("❌ Error switching tables:", error);
    throw error;
  }
}

async function main() {
  const cityNames = process.argv[2];
  
  if (!cityNames) {
    console.error('Usage: node scripts/detect-specific-cities.js "Oakville,Burlington,Milwaukee"');
    process.exit(1);
  }

  const citiesToProcess = cityNames.split(',').map(name => name.trim());
  
  console.log(`🚀 Starting city-specific detection for: ${citiesToProcess.join(', ')}`);
  
  try {
    // Run detection for specific cities only
    const { totalJustListed, totalSold } = await detectForSpecificCities(citiesToProcess);
    
    console.log(`\n📈 DETECTION RESULTS:`);
    console.log(`   - Total just-listed: ${totalJustListed}`);
    console.log(`   - Total sold: ${totalSold}`);
    
    // Switch tables for next run
    console.log('\n🔄 Switching tables for next run...');
    await switchTables();
    
    console.log('\n✅ City-specific detection completed successfully!');
    
  } catch (error) {
    console.error("❌ Detection process failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);