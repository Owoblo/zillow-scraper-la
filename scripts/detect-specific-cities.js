#!/usr/bin/env node

// Script to run detection logic for specific cities only
// Usage: node scripts/detect-specific-cities.js "Oakville,Burlington,Milwaukee"

import { createClient } from "@supabase/supabase-js";
import { detectJustListedAndSoldByRegion } from '../zillow.js';
import { getAllCities } from '../config/regions.js';

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate unique run ID
const runId = `detect-${Date.now()}`;

async function runDetectionForCities(cityNames) {
  console.log(`🔍 Running detection for specific cities: ${cityNames.join(', ')}`);
  console.log(`🆔 Run ID: ${runId}`);
  console.log('');

  // Get all available cities from regions configuration
  const allCities = getAllCities();
  const cityMap = {};
  
  allCities.forEach(city => {
    cityMap[city.name] = {
      regionName: city.regionName,
      regionKey: city.regionKey
    };
  });

  // Validate cities
  const invalidCities = cityNames.filter(name => !cityMap[name]);
  if (invalidCities.length > 0) {
    console.error(`❌ Invalid cities: ${invalidCities.join(', ')}`);
    console.error('Available cities:', Object.keys(cityMap).join(', '));
    process.exit(1);
  }

  // Group cities by region
  const citiesByRegion = {};
  cityNames.forEach(cityName => {
    const cityInfo = cityMap[cityName];
    const regionKey = cityInfo.regionKey;
    
    if (!citiesByRegion[regionKey]) {
      citiesByRegion[regionKey] = {
        regionName: cityInfo.regionName,
        cities: []
      };
    }
    citiesByRegion[regionKey].cities.push(cityName);
  });

  console.log(`📊 Processing ${cityNames.length} cities across ${Object.keys(citiesByRegion).length} regions:`);
  Object.entries(citiesByRegion).forEach(([regionKey, regionData]) => {
    console.log(`   - ${regionData.regionName}: ${regionData.cities.join(', ')}`);
  });
  console.log('');

  let totalJustListed = 0;
  let totalSold = 0;
  const results = {};

  // Run detection for each region with proper city filtering
  for (const [regionKey, regionData] of Object.entries(citiesByRegion)) {
    console.log(`\n🏙️  Processing ${regionData.regionName}...`);
    console.log(`📍 Cities: ${regionData.cities.join(', ')}`);
    
    try {
      // First, check if we have data for this region
      console.log(`🔍 Checking data availability for ${regionData.regionName}...`);
      
      const { data: currentData, error: currentError } = await supabase
        .from('current_listings')
        .select('*')
        .eq('region', regionData.regionName)
        .in('city', regionData.cities);
      
      if (currentError) throw currentError;
      
      const { data: previousData, error: previousError } = await supabase
        .from('previous_listings')
        .select('*')
        .eq('region', regionData.regionName)
        .in('city', regionData.cities);
      
      if (previousError) throw previousError;
      
      console.log(`📊 Current: ${currentData.length} listings, Previous: ${previousData.length} listings`);
      
      if (currentData.length === 0) {
        console.log(`⚠️  No current data for ${regionData.regionName} - skipping detection`);
        results[regionKey] = {
          regionName: regionData.regionName,
          cities: regionData.cities,
          justListed: 0,
          sold: 0,
          error: 'No current data available'
        };
        continue;
      }
      
      if (previousData.length === 0) {
        console.log(`⚠️  No previous data for ${regionData.regionName} - this appears to be a first-time run`);
        console.log(`💡 Skipping detection to avoid false positives`);
        results[regionKey] = {
          regionName: regionData.regionName,
          cities: regionData.cities,
          justListed: 0,
          sold: 0,
          error: 'No previous data - first time run'
        };
        continue;
      }
      
      // Run actual detection
      const regionResult = await detectJustListedAndSoldByRegion(regionKey, runId, regionData.cities);
      
      results[regionKey] = {
        regionName: regionData.regionName,
        cities: regionData.cities,
        justListed: regionResult.justListed.length,
        sold: regionResult.soldListings.length,
        justListedList: regionResult.justListed,
        soldList: regionResult.soldListings
      };
      
      totalJustListed += regionResult.justListed.length;
      totalSold += regionResult.soldListings.length;
      
      console.log(`✅ ${regionData.regionName}: ${regionResult.justListed.length} just-listed, ${regionResult.soldListings.length} sold`);
      
    } catch (error) {
      console.error(`❌ Error processing ${regionData.regionName}:`, error.message);
      results[regionKey] = {
        regionName: regionData.regionName,
        cities: regionData.cities,
        error: error.message
      };
    }
  }

  // Summary
  console.log('\n📊 DETECTION RESULTS:');
  console.log(`Total just-listed: ${totalJustListed}`);
  console.log(`Total sold: ${totalSold}`);
  console.log('\nPer Region:');
  
  Object.entries(results).forEach(([regionKey, result]) => {
    if (result.error) {
      console.log(`❌ ${result.regionName}: ${result.error}`);
    } else {
      console.log(`✅ ${result.regionName}: ${result.justListed} just-listed, ${result.sold} sold`);
      
      // Show some examples
      if (result.justListed > 0) {
        console.log(`   📍 Just-listed examples: ${result.justListedList.slice(0, 3).map(item => item.address).join(', ')}${result.justListed > 3 ? '...' : ''}`);
      }
      if (result.sold > 0) {
        console.log(`   🏠 Sold examples: ${result.soldList.slice(0, 3).map(item => item.address).join(', ')}${result.sold > 3 ? '...' : ''}`);
      }
    }
  });

  console.log('\n🎉 Detection completed for specified cities!');
  
  return {
    totalJustListed,
    totalSold,
    results
  };
}

async function main() {
  const cityNames = process.argv[2];
  
  if (!cityNames) {
    console.error('Usage: node scripts/detect-specific-cities.js "Oakville,Burlington,Milwaukee"');
    console.error('Available cities:', getAllCities().map(c => c.name).join(', '));
    process.exit(1);
  }

  const citiesToDetect = cityNames.split(',').map(name => name.trim());
  
  try {
    await runDetectionForCities(citiesToDetect);
  } catch (error) {
    console.error('❌ Detection failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
