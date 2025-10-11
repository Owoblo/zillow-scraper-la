#!/usr/bin/env node

// Advanced city-by-city detection with timeout handling and retries
import { createClient } from "@supabase/supabase-js";
import { getAllCities } from './config/regions.js';
import { sendScrapeNotification } from './emailService.js';

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CONFIG = {
  DETECTION_TIMEOUT_MS: 30000, // 30 seconds per city
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  BATCH_SIZE: 100
};

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Detect changes for a single city with timeout handling
async function detectCityChanges(cityName, timeoutMs = CONFIG.DETECTION_TIMEOUT_MS) {
  console.log(`🔍 Detecting changes for ${cityName}...`);
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Detection timeout for ${cityName} after ${timeoutMs}ms`)), timeoutMs);
    });
    
    // Create the detection promise
    const detectionPromise = detectCityChangesInternal(cityName);
    
    // Race between detection and timeout
    const result = await Promise.race([detectionPromise, timeoutPromise]);
    
    console.log(`✅ ${cityName}: ${result.justListed.length} just-listed, ${result.soldListings.length} sold`);
    return result;
    
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log(`⏰ ${cityName}: Detection timeout - will retry with smaller batches`);
      return await detectCityChangesWithBatching(cityName);
    } else {
      console.error(`❌ ${cityName}: Detection error:`, error.message);
      return { justListed: [], soldListings: [], error: error.message };
    }
  }
}

// Internal detection logic for a single city
async function detectCityChangesInternal(cityName) {
  // Get current listings for this city
  const { data: currentListings, error: currentError } = await supabase
    .from('current_listings')
    .select('*')
    .eq('addresscity', cityName);
    
  if (currentError) throw currentError;
  
  // Get previous listings for this city
  const { data: previousListings, error: previousError } = await supabase
    .from('previous_listings')
    .select('*')
    .eq('addresscity', cityName);
    
  if (previousError) throw previousError;
  
  console.log(`📊 ${cityName}: Current=${currentListings.length}, Previous=${previousListings.length}`);
  
  // Create sets for faster lookup
  const currentZpids = new Set(currentListings.map(l => l.zpid));
  const previousZpids = new Set(previousListings.map(l => l.zpid));
  
  // Find just-listed (in current but not in previous)
  const justListed = currentListings.filter(listing => !previousZpids.has(listing.zpid));
  
  // Find sold (in previous but not in current)
  const soldListings = previousListings.filter(listing => !currentZpids.has(listing.zpid));
  
  return { justListed, soldListings };
}

// Fallback detection with batching for timeout-prone cities
async function detectCityChangesWithBatching(cityName) {
  console.log(`🔄 ${cityName}: Using batched detection to avoid timeout...`);
  
  try {
    // Get counts first
    const { count: currentCount } = await supabase
      .from('current_listings')
      .select('*', { count: 'exact', head: true })
      .eq('addresscity', cityName);
      
    const { count: previousCount } = await supabase
      .from('previous_listings')
      .select('*', { count: 'exact', head: true })
      .eq('addresscity', cityName);
    
    console.log(`📊 ${cityName}: Current=${currentCount}, Previous=${previousCount}`);
    
    if (currentCount === 0 && previousCount === 0) {
      return { justListed: [], soldListings: [] };
    }
    
    // Process in smaller batches
    const currentZpids = new Set();
    const previousZpids = new Set();
    
    // Get current listings in batches
    for (let offset = 0; offset < currentCount; offset += CONFIG.BATCH_SIZE) {
      const { data: batch } = await supabase
        .from('current_listings')
        .select('zpid')
        .eq('addresscity', cityName)
        .range(offset, offset + CONFIG.BATCH_SIZE - 1);
        
      if (batch) {
        batch.forEach(listing => currentZpids.add(listing.zpid));
      }
    }
    
    // Get previous listings in batches
    for (let offset = 0; offset < previousCount; offset += CONFIG.BATCH_SIZE) {
      const { data: batch } = await supabase
        .from('previous_listings')
        .select('zpid')
        .eq('addresscity', cityName)
        .range(offset, offset + CONFIG.BATCH_SIZE - 1);
        
      if (batch) {
        batch.forEach(listing => previousZpids.add(listing.zpid));
      }
    }
    
    // Find differences
    const justListedZpids = [...currentZpids].filter(zpid => !previousZpids.has(zpid));
    const soldZpids = [...previousZpids].filter(zpid => !currentZpids.has(zpid));
    
    // Get full data for just-listed
    const justListed = [];
    for (const zpid of justListedZpids) {
      const { data: listing } = await supabase
        .from('current_listings')
        .select('*')
        .eq('zpid', zpid)
        .eq('addresscity', cityName)
        .single();
        
      if (listing) justListed.push(listing);
    }
    
    // Get full data for sold
    const soldListings = [];
    for (const zpid of soldZpids) {
      const { data: listing } = await supabase
        .from('previous_listings')
        .select('*')
        .eq('zpid', zpid)
        .eq('addresscity', cityName)
        .single();
        
      if (listing) soldListings.push(listing);
    }
    
    console.log(`✅ ${cityName}: ${justListed.length} just-listed, ${soldListings.length} sold (batched)`);
    return { justListed, soldListings };
    
  } catch (error) {
    console.error(`❌ ${cityName}: Batched detection failed:`, error.message);
    return { justListed: [], soldListings: [], error: error.message };
  }
}

// Store detection results
async function storeDetectionResults(justListed, soldListings) {
  try {
    if (justListed.length > 0) {
      const { error: justListedError } = await supabase
        .from('just_listed')
        .upsert(justListed, { onConflict: 'zpid' });
        
      if (justListedError) throw justListedError;
      console.log(`💾 Stored ${justListed.length} just-listed properties`);
    }
    
    if (soldListings.length > 0) {
      const { error: soldError } = await supabase
        .from('sold_listings')
        .upsert(soldListings, { onConflict: 'zpid' });
        
      if (soldError) throw soldError;
      console.log(`💾 Stored ${soldListings.length} sold properties`);
    }
    
  } catch (error) {
    console.error('❌ Error storing detection results:', error.message);
  }
}

// Main detection function
async function runAdvancedDetection() {
  console.log('🚀 Starting Advanced City-by-City Detection...');
  
  const cities = getAllCities();
  const allJustListed = [];
  const allSoldListings = [];
  const results = {};
  
  console.log(`📍 Processing ${cities.length} cities...`);
  
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    console.log(`\n📊 Progress: ${i + 1}/${cities.length} cities`);
    
    let retryCount = 0;
    let cityResult = null;
    
    // Retry logic for each city
    while (retryCount < CONFIG.MAX_RETRIES && !cityResult) {
      try {
        cityResult = await detectCityChanges(city.name);
        results[city.name] = cityResult;
        
        allJustListed.push(...cityResult.justListed);
        allSoldListings.push(...cityResult.soldListings);
        
        break;
        
      } catch (error) {
        retryCount++;
        console.log(`⚠️ ${city.name}: Attempt ${retryCount} failed: ${error.message}`);
        
        if (retryCount < CONFIG.MAX_RETRIES) {
          console.log(`⏳ Waiting ${CONFIG.RETRY_DELAY_MS}ms before retry...`);
          await sleep(CONFIG.RETRY_DELAY_MS);
        } else {
          console.log(`❌ ${city.name}: Max retries exceeded`);
          results[city.name] = { justListed: [], soldListings: [], error: error.message };
        }
      }
    }
    
    // Small delay between cities
    await sleep(500);
  }
  
  // Store all results
  console.log('\n💾 Storing detection results...');
  await storeDetectionResults(allJustListed, allSoldListings);
  
  // Summary
  console.log('\n📊 DETECTION SUMMARY:');
  console.log(`Total just-listed: ${allJustListed.length}`);
  console.log(`Total sold: ${allSoldListings.length}`);
  
  console.log('\nPer City:');
  Object.entries(results).forEach(([city, result]) => {
    if (result.error) {
      console.log(`❌ ${city}: ${result.error}`);
    } else {
      console.log(`✅ ${city}: ${result.justListed.length} just-listed, ${result.soldListings.length} sold`);
    }
  });
  
  // Send email notification
  console.log('\n📧 Sending detection results email...');
  try {
    const emailData = {
      success: true,
      totalListings: 0, // Detection only, no new listings scraped
      justListed: allJustListed.length,
      soldListings: allSoldListings.length,
      runDuration: 'Detection Only',
      timestamp: new Date().toISOString(),
      cityDetails: Object.entries(results).map(([cityName, result]) => ({
        name: cityName,
        region: 'Detection Results',
        justListed: result.justListed.length,
        sold: result.soldListings.length,
        total: 0
      })),
      failedCities: Object.entries(results)
        .filter(([_, result]) => result.error)
        .map(([cityName, _]) => cityName)
    };
    
    await sendScrapeNotification(emailData);
  } catch (error) {
    console.error('❌ Failed to send email notification:', error.message);
  }

  return { justListed: allJustListed, soldListings: allSoldListings, results };
}

// Export for use in other modules
export { runAdvancedDetection, detectCityChanges };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedDetection().catch(console.error);
}
