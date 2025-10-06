import { createClient } from '@supabase/supabase-js';
import fs from "graceful-fs";
import { REGIONS } from "./config/regions.js";

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
 * Standalone function to detect just-listed and sold listings
 * This can be run independently or as part of the main scraping process
 */
async function detectJustListedAndSold(regionKey = null) {
  console.log("🔍 Detecting just-listed and sold listings...");
  
  try {
    // Get current and previous listings with optional regional filtering
    let currentQuery = supabase.from(CURRENT_LISTINGS_TABLE).select("*");
    let previousQuery = supabase.from(PREVIOUS_LISTINGS_TABLE).select("*");
    
    // Filter by region if specified
    if (regionKey) {
      const region = REGIONS[regionKey];
      if (region) {
        currentQuery = currentQuery.eq('region', region.name);
        previousQuery = previousQuery.eq('region', region.name);
        console.log(`🔍 Filtering by region: ${region.name}`);
      }
    }
    
    const { data: currentListings, error: currentError } = await currentQuery;
    if (currentError) throw currentError;

    const { data: previousListings, error: prevError } = await previousQuery;
    if (prevError) throw prevError;

    // Create sets for efficient comparison
    const currentZpidSet = new Set(currentListings.map(l => l.zpid));
    const previousZpidSet = new Set(previousListings.map(l => l.zpid));

    // Find just-listed (in current but not in previous)
    const justListed = currentListings.filter(listing => !previousZpidSet.has(listing.zpid));
    
    // Find sold (in previous but not in current)
    const soldListings = previousListings.filter(listing => !currentZpidSet.has(listing.zpid));

    console.log(`📊 Found ${justListed.length} just-listed and ${soldListings.length} sold listings`);

    // Store just-listed listings
    if (justListed.length > 0) {
      const { error: justListedError } = await supabase
        .from(JUST_LISTED_TABLE)
        .upsert(justListed, { onConflict: "zpid" });
      
      if (justListedError) throw justListedError;
      console.log(`✅ Stored ${justListed.length} just-listed listings`);
    }

    // Store sold listings
    if (soldListings.length > 0) {
      const { error: soldError } = await supabase
        .from(SOLD_LISTINGS_TABLE)
        .upsert(soldListings, { onConflict: "zpid" });
      
      if (soldError) throw soldError;
      console.log(`✅ Stored ${soldListings.length} sold listings`);
    }

    // Save to JSON files for inspection
    fs.writeFileSync("just_listed.json", JSON.stringify(justListed, null, 2));
    fs.writeFileSync("sold_listings.json", JSON.stringify(soldListings, null, 2));

    return { justListed, soldListings };
  } catch (error) {
    console.error("❌ Error detecting listings:", error);
    throw error;
  }
}

/**
 * Switch tables for next run (current becomes previous)
 */
async function switchTables() {
  console.log("🔄 Switching tables for next run...");
  
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

/**
 * Get just-listed listings from the database
 */
async function getJustListed() {
  const { data, error } = await supabase
    .from(JUST_LISTED_TABLE)
    .select("*")
    .order("lastSeenAt", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get sold listings from the database
 */
async function getSoldListings() {
  const { data, error } = await supabase
    .from(SOLD_LISTINGS_TABLE)
    .select("*")
    .order("lastSeenAt", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Main function to run detection and table switching
 */
async function main(regionKey = null) {
  try {
    console.log("🚀 Starting listing detection process...");
    if (regionKey) {
      console.log(`🏙️  Processing region: ${regionKey}`);
    }
    
    // Detect just-listed and sold listings
    const { justListed, soldListings } = await detectJustListedAndSold(regionKey);
    
    // Switch tables for next run
    await switchTables();
    
    console.log("\n✅ Listing detection completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Just-listed: ${justListed.length}`);
    console.log(`   - Sold: ${soldListings.length}`);
    
    if (regionKey) {
      console.log(`   - Region: ${regionKey}`);
    }
    
  } catch (error) {
    console.error("❌ Detection process failed:", error);
    process.exit(1);
  }
}

// Export functions for use in other modules
export { 
  detectJustListedAndSold, 
  switchTables, 
  getJustListed, 
  getSoldListings 
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for region argument
  const regionArg = process.argv[2];
  main(regionArg);
}