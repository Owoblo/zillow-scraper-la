#!/usr/bin/env node

// Delayed retry script that runs 30 minutes after main scrape
// Only runs if there are still failed cities after initial retries
// Usage: node scripts/delayed-retry.js

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
 * Get cities that still have low data quality after initial retries
 */
async function getStillFailedCities() {
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

    // Find cities with low data quality (less than 70% of expected)
    const stillFailedCities = [];
    Object.entries(cityCounts).forEach(([city, count]) => {
      const expected = expectedCounts[city] || 200;
      const quality = count / expected;
      
      if (quality < 0.7) {
        stillFailedCities.push(city);
        console.log(`⚠️  ${city}: ${count} listings (expected ~${expected}) - Quality: ${(quality * 100).toFixed(1)}%`);
      } else {
        console.log(`✅ ${city}: ${count} listings (expected ~${expected}) - Quality: ${(quality * 100).toFixed(1)}%`);
      }
    });

    return stillFailedCities;
  } catch (error) {
    console.error('❌ Error getting still failed cities:', error.message);
    return [];
  }
}

/**
 * Run delayed retry for still failed cities
 */
async function runDelayedRetry(stillFailedCities) {
  if (stillFailedCities.length === 0) {
    console.log('✅ No still failed cities to retry - all cities have good data quality!');
    return;
  }

  console.log(`\n🔄 Running delayed retry for ${stillFailedCities.length} still failed cities: ${stillFailedCities.join(', ')}`);
  
  try {
    // Run the retry script for specific cities
    const citiesString = stillFailedCities.join(',');
    const command = `npm run retry:failed "${citiesString}"`;
    
    console.log(`\n🚀 Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    
    console.log('\n✅ Delayed retry completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running delayed retry:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('⏰ DELAYED RETRY SYSTEM (30 minutes after main scrape)');
  console.log('====================================================\n');
  
  try {
    // Step 1: Check if we should run (only if there are still failed cities)
    console.log('📊 Checking for still failed cities...');
    const stillFailedCities = await getStillFailedCities();
    
    if (stillFailedCities.length === 0) {
      console.log('✅ All cities have good data quality - no delayed retry needed!');
      console.log('🎉 System is working perfectly!');
      return;
    }
    
    // Step 2: Run delayed retry for still failed cities
    console.log(`\n⏰ Running delayed retry for ${stillFailedCities.length} cities...`);
    await runDelayedRetry(stillFailedCities);
    
    console.log('\n🎉 Delayed retry process completed!');
    
  } catch (error) {
    console.error('❌ Delayed retry process failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, getStillFailedCities, runDelayedRetry };
