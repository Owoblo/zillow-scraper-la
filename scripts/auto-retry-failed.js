#!/usr/bin/env node

// Auto-retry script for failed cities with detection
// This script can be run after the main scrape to automatically retry failed cities
// Usage: node scripts/auto-retry-failed.js

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

// Initialize Supabase client
const supabase = createClient(
  'https://idbyrtwdeeruiutoukct.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko'
);

// Table names
const CURRENT_LISTINGS_TABLE = "current_listings";
const PREVIOUS_LISTINGS_TABLE = "previous_listings";

/**
 * Get cities that have low data quality (failed cities)
 */
async function getFailedCities() {
  try {
    // Get current listings count by city
    const { data: currentData } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select('city')
      .order('city');
    
    if (!currentData || currentData.length === 0) {
      console.log('ℹ️  No current listings found - no failed cities to retry');
      return [];
    }

    // Count listings per city
    const cityCounts = {};
    currentData.forEach(item => {
      cityCounts[item.city] = (cityCounts[item.city] || 0) + 1;
    });

    // Define expected minimum counts per city
    const expectedCounts = {
      'Toronto': 800,
      'Mississauga': 600,
      'Brampton': 600,
      'Markham': 600,
      'Vaughan': 600,
      'Richmond Hill': 600,
      'Oakville': 500,
      'Burlington': 500,
      'Windsor': 800,
      'Kingsville': 200,
      'Leamington': 200,
      'Lakeshore': 200,
      'Essex': 200,
      'Tecumseh': 200,
      'Lasalle': 200,
      'Chatham-Kent': 200,
      'Amherstburg': 200,
      'Milwaukee': 500
    };

    // Find cities with low data quality
    const failedCities = [];
    Object.entries(cityCounts).forEach(([city, count]) => {
      const expected = expectedCounts[city] || 200;
      const quality = count / expected;
      
      if (quality < 0.7) { // Less than 70% of expected
        failedCities.push(city);
        console.log(`⚠️  ${city}: ${count} listings (expected ~${expected}) - Quality: ${(quality * 100).toFixed(1)}%`);
      } else {
        console.log(`✅ ${city}: ${count} listings (expected ~${expected}) - Quality: ${(quality * 100).toFixed(1)}%`);
      }
    });

    return failedCities;
  } catch (error) {
    console.error('❌ Error getting failed cities:', error.message);
    return [];
  }
}

/**
 * Run retry for failed cities
 */
async function retryFailedCities(failedCities) {
  if (failedCities.length === 0) {
    console.log('✅ No failed cities to retry!');
    return;
  }

  console.log(`\n🔄 Retrying ${failedCities.length} failed cities: ${failedCities.join(', ')}`);
  
  try {
    // Run the retry script
    const citiesString = failedCities.join(',');
    const command = `npm run retry:failed "${citiesString}"`;
    
    console.log(`\n🚀 Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    
    console.log('\n✅ Retry completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running retry:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 AUTO-RETRY SYSTEM FOR FAILED CITIES');
  console.log('=====================================\n');
  
  try {
    // Step 1: Check current system status
    console.log('📊 Checking current system status...');
    const { count: currentCount } = await supabase.from(CURRENT_LISTINGS_TABLE).select('*', { count: 'exact', head: true });
    const { count: prevCount } = await supabase.from(PREVIOUS_LISTINGS_TABLE).select('*', { count: 'exact', head: true });
    
    console.log(`   Current listings: ${currentCount}`);
    console.log(`   Previous listings: ${prevCount}`);
    
    if (currentCount === 0) {
      console.log('ℹ️  No current listings - run main scrape first');
      return;
    }
    
    // Step 2: Identify failed cities
    console.log('\n🔍 Identifying failed cities...');
    const failedCities = await getFailedCities();
    
    if (failedCities.length === 0) {
      console.log('✅ All cities have good data quality - no retry needed!');
      return;
    }
    
    // Step 3: Retry failed cities
    await retryFailedCities(failedCities);
    
    console.log('\n🎉 Auto-retry process completed!');
    
  } catch (error) {
    console.error('❌ Auto-retry process failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, getFailedCities, retryFailedCities };
