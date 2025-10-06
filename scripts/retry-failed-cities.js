#!/usr/bin/env node

// Script to retry specific failed cities with no detection logic
// Usage: node scripts/retry-failed-cities.js "Mississauga,Markham,Vaughan"

import { createClient } from "@supabase/supabase-js";
import { getSmartProxyAgent } from '../proxies.js';
import { mapItemToRow, upsertListingsWithValidation } from '../scraper-improvements.js';

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const PAGE_DELAY_MS = 400;
const UPSERT_BATCH_SIZE = 200;
const UPSERT_RETRIES = 3;
const PAGE_RETRY_LIMIT = 5;
const RETRY_BASE_MS = 1000;

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique run ID
const runId = `retry-${Date.now()}`;

// Failed cities configuration with exact Zillow coordinates
const FAILED_CITIES = {
  "Mississauga": {
    mapBounds: {
      north: 43.737325,
      south: 43.474915,
      east: -79.52296,
      west: -79.810253
    },
    regionId: 792679,
    regionName: "Greater Toronto Area"
  },
  "Markham": {
    mapBounds: {
      north: 43.946335631712174,
      south: 43.81518110458399,
      east: -79.06258629980469,
      west: -79.53637170019532
    },
    regionId: 792840,
    regionName: "Greater Toronto Area"
  },
  "Vaughan": {
    mapBounds: {
      north: 43.96822900411137,
      south: 43.70572776600755,
      east: -79.09200809960939,
      west: -80.03957890039064
    },
    regionId: 792841,
    regionName: "Greater Toronto Area"
  }
};


async function getSearchResults(cityName, cityConfig) {
  const { mapBounds, regionId } = cityConfig;
  const allListings = [];
  let page = 1;
  let hasMorePages = true;

  console.log(`📍 Fetching ${cityName}...`);

  while (hasMorePages && page <= 20) {
    try {
      const searchQueryState = {
        pagination: { currentPage: page },
        isMapVisible: true,
        mapBounds: mapBounds,
        regionSelection: [{ regionId: regionId, regionType: 6 }],
        filterState: {
          sortSelection: { value: "globalrelevanceex" },
          isAllHomes: { value: true },
        },
        isEntirePlaceForRent: true,
        isRoomForRent: false,
        isListVisible: true,
      };

      const response = await fetch("https://www.zillow.com/async-create-search-page-state", {
        agent: getSmartProxyAgent(),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
          priority: "u=1, i",
          "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          Referer: "https://www.zillow.com/homes/",
          "Referrer-Policy": "unsafe-url",
        },
        body: JSON.stringify({
          searchQueryState,
          wants: { cat1: ["listResults", "mapResults"], cat2: ["total"] },
        }),
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // Check if we got HTML instead of JSON (parse error)
      if (text.trim().startsWith('<')) {
        throw new Error('Got HTML instead of JSON');
      }

      const data = JSON.parse(text);
      
      if (!data || !data.cat1 || !data.cat1.searchResults) {
        throw new Error('Invalid response structure');
      }

      const listings = data.cat1.searchResults.mapResults || [];
      
      if (listings.length === 0) {
        console.log(`No more results for ${cityName} at page ${page}.`);
        hasMorePages = false;
        break;
      }

      allListings.push(...listings);
      console.log(`${cityName}: page ${page} -> ${listings.length} listings (total: ${allListings.length})`);
      
      page++;
      await sleep(PAGE_DELAY_MS);
    } catch (error) {
      console.error(`❌ Error fetching ${cityName} page ${page}:`, error.message);
      hasMorePages = false;
    }
  }

  return allListings;
}

async function processCity(cityName, cityConfig) {
  try {
    const listings = await getSearchResults(cityName, cityConfig);
    
    if (listings.length === 0) {
      console.log(`❌ ${cityName}: No listings found`);
      return { success: false, listings: 0, error: 'No listings found' };
    }

    // Map listings to database format
    const mappedRows = listings
      .map(item => mapItemToRow(item, cityName, 1, runId, cityConfig.regionName))
      .filter(row => row !== null);

    if (mappedRows.length === 0) {
      console.log(`❌ ${cityName}: No valid listings after mapping`);
      return { success: false, listings: 0, error: 'No valid listings after mapping' };
    }

    // Store in database
    await upsertListingsWithValidation(mappedRows, 'current_listings');
    
    console.log(`✅ ${cityName}: Successfully processed ${mappedRows.length} listings`);
    return { success: true, listings: mappedRows.length };
  } catch (error) {
    console.error(`❌ ${cityName}: Error processing city:`, error.message);
    return { success: false, listings: 0, error: error.message };
  }
}

async function main() {
  const cityNames = process.argv[2];
  
  if (!cityNames) {
    console.error('Usage: node scripts/retry-failed-cities.js "Mississauga,Markham,Vaughan"');
    console.error('Available cities:', Object.keys(FAILED_CITIES).join(', '));
    process.exit(1);
  }

  const citiesToRetry = cityNames.split(',').map(name => name.trim());
  const invalidCities = citiesToRetry.filter(name => !FAILED_CITIES[name]);
  
  if (invalidCities.length > 0) {
    console.error(`❌ Invalid cities: ${invalidCities.join(', ')}`);
    console.error('Available cities:', Object.keys(FAILED_CITIES).join(', '));
    process.exit(1);
  }

  console.log(`🚀 Retrying failed cities: ${citiesToRetry.join(', ')}`);
  console.log(`🆔 Run ID: ${runId}`);
  console.log(`ℹ️  Detection will be SKIPPED - just populating database`);
  console.log('');

  const results = {};
  let totalListings = 0;

  for (const cityName of citiesToRetry) {
    const cityConfig = FAILED_CITIES[cityName];
    console.log(`\n🏙️  Processing ${cityName}...`);
    
    const result = await processCity(cityName, cityConfig);
    results[cityName] = result;
    
    if (result.success) {
      totalListings += result.listings;
    }
    
    // Small delay between cities
    await sleep(1000);
  }

  // Summary
  console.log('\n📊 RETRY RESULTS:');
  console.log(`Total listings processed: ${totalListings}`);
  console.log('\nPer City:');
  Object.entries(results).forEach(([city, result]) => {
    if (result.success) {
      console.log(`✅ ${city}: ${result.listings} listings`);
    } else {
      console.log(`❌ ${city}: ${result.error}`);
    }
  });

  console.log('\n🎉 Failed cities retry completed!');
}

main().catch(console.error);
