#!/usr/bin/env node

// Advanced Zillow scraper with anti-detection capabilities
import { createClient } from "@supabase/supabase-js";
import { advancedFetch, getRandomDelay, trackProxySuccess, trackProxyFailure } from './advanced-proxies.js';
import { scheduler, SCHEDULING_STRATEGIES } from './advanced-scheduler.js';
import { mapItemToRow, upsertListingsWithValidation } from './zillow.js';
import { getAllCities } from './config/regions.js';

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Advanced configuration
const CONFIG = {
  // Request settings
  PAGE_DELAY_MS: { min: 400, max: 2000 },
  MAX_PAGES_PER_CITY: 20,
  MAX_RETRIES: 3,
  RETRY_BASE_MS: 1000,
  
  // Anti-detection settings
  RANDOM_DELAY_CHANCE: 0.05, // 5% chance of extra long delay
  MAX_RANDOM_DELAY: 5000,
  PROXY_ROTATION_INTERVAL: 5, // Rotate every 5 requests
  
  // Batch processing
  UPSERT_BATCH_SIZE: 200,
  UPSERT_RETRIES: 3,
  
  // City processing
  MAX_CITIES_PER_BATCH: 5,
  BATCH_DELAY_MS: 3000
};

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique run ID
const runId = `advanced-${Date.now()}`;

// Advanced city processing with anti-detection
async function processCityAdvanced(cityName, cityConfig) {
  const startTime = Date.now();
  console.log(`🏙️  Processing ${cityName} (${cityConfig.regionName})...`);
  
  try {
    const listings = await getSearchResultsAdvanced(cityName, cityConfig);
    
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

    // Store in database with retry logic
    await upsertListingsWithValidation(mappedRows, 'current_listings');
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${cityName}: Successfully processed ${mappedRows.length} listings in ${duration}ms`);
    return { success: true, listings: mappedRows.length, duration };
    
  } catch (error) {
    console.error(`❌ ${cityName}: Error processing city:`, error.message);
    return { success: false, listings: 0, error: error.message };
  }
}

// Advanced search results fetching with anti-detection
async function getSearchResultsAdvanced(cityName, cityConfig) {
  const { mapBounds, regionId } = cityConfig;
  const allListings = [];
  let page = 1;
  let hasMorePages = true;
  let consecutiveErrors = 0;

  console.log(`📍 Fetching ${cityName}...`);

  while (hasMorePages && page <= CONFIG.MAX_PAGES_PER_CITY) {
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

      // Determine city region for proxy selection
      const cityRegion = cityConfig.regionName.includes('Milwaukee') ? 'US' : 'CA';

      const response = await advancedFetch(
        "https://www.zillow.com/async-create-search-page-state",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "Referer": "https://www.zillow.com/homes/",
            "Referrer-Policy": "unsafe-url",
          },
          body: JSON.stringify({
            searchQueryState,
            wants: { cat1: ["listResults", "mapResults"], cat2: ["total"] },
          }),
        },
        cityRegion,
        CONFIG.MAX_RETRIES
      );

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
      
      // Reset error counter on success
      consecutiveErrors = 0;
      
      page++;
      
      // Advanced delay with randomization
      const baseDelay = getRandomDelay();
      const randomDelay = Math.random() < CONFIG.RANDOM_DELAY_CHANCE 
        ? baseDelay + Math.random() * CONFIG.MAX_RANDOM_DELAY
        : baseDelay;
      
      await sleep(randomDelay);
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Error fetching ${cityName} page ${page}:`, error.message);
      
      if (consecutiveErrors >= 3) {
        console.log(`❌ Too many consecutive errors for ${cityName}, stopping`);
        hasMorePages = false;
        break;
      }
      
      // Exponential backoff on errors
      const errorDelay = CONFIG.RETRY_BASE_MS * Math.pow(2, consecutiveErrors - 1);
      console.log(`⏳ Waiting ${errorDelay}ms before retry...`);
      await sleep(errorDelay);
    }
  }

  return allListings;
}

// Process cities in intelligent batches
async function processCitiesInBatches(cities) {
  const results = {};
  let totalListings = 0;
  let processedCount = 0;

  // Process cities in batches to avoid overwhelming the system
  for (let i = 0; i < cities.length; i += CONFIG.MAX_CITIES_PER_BATCH) {
    const batch = cities.slice(i, i + CONFIG.MAX_CITIES_PER_BATCH);
    console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.MAX_CITIES_PER_BATCH) + 1}/${Math.ceil(cities.length / CONFIG.MAX_CITIES_PER_BATCH)} (${batch.length} cities)`);
    
    // Process cities in parallel within batch
    const batchPromises = batch.map(async (city) => {
      const result = await processCityAdvanced(city.name, city);
      results[city.name] = result;
      
      if (result.success) {
        totalListings += result.listings;
      }
      
      processedCount++;
      console.log(`📊 Progress: ${processedCount}/${cities.length} cities (${totalListings} total listings)`);
      
      return result;
    });
    
    await Promise.all(batchPromises);
    
    // Delay between batches
    if (i + CONFIG.MAX_CITIES_PER_BATCH < cities.length) {
      console.log(`⏳ Waiting ${CONFIG.BATCH_DELAY_MS}ms before next batch...`);
      await sleep(CONFIG.BATCH_DELAY_MS);
    }
  }

  return { results, totalListings };
}

// Main advanced scraping function
async function runAdvancedScraper() {
  console.log('🚀 Starting Advanced Zillow Scraper with Anti-Detection...');
  console.log(`🆔 Run ID: ${runId}`);
  console.log(`📊 Strategy: ${scheduler.currentStrategy}`);
  
  // Get all cities in optimal order
  const cities = scheduler.getAllCitiesInOrder();
  console.log(`📍 Total cities to process: ${cities.length}`);
  
  // Process cities
  const { results, totalListings } = await processCitiesInBatches(cities);
  
  // Summary
  console.log('\n📊 ADVANCED SCRAPER RESULTS:');
  console.log(`Total listings processed: ${totalListings}`);
  console.log(`Successful cities: ${Object.values(results).filter(r => r.success).length}`);
  console.log(`Failed cities: ${Object.values(results).filter(r => !r.success).length}`);
  
  console.log('\nPer City:');
  Object.entries(results).forEach(([city, result]) => {
    if (result.success) {
      console.log(`✅ ${city}: ${result.listings} listings`);
    } else {
      console.log(`❌ ${city}: ${result.error}`);
    }
  });

  // Show scheduling stats
  const stats = scheduler.getStats();
  console.log('\n📈 SCHEDULING STATISTICS:');
  console.log(`Strategy: ${stats.currentStrategy}`);
  console.log(`Cities scheduled: ${stats.totalScheduled}`);
  console.log('Region distribution:', stats.regionDistribution);
  
  console.log('\n🎉 Advanced scraper completed!');
  
  return { results, totalListings };
}

// Export for use in other modules
export { runAdvancedScraper, processCityAdvanced, getSearchResultsAdvanced };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedScraper().catch(console.error);
}
