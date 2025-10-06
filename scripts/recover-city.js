#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { getAllCities, getCitiesForRegion } from '../zillow.js';
import { fetchPageWithRetries, mapItemToRow, upsertListingsWithValidation } from '../zillow.js';
import { sleep } from '../zillow.js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CURRENT_LISTINGS_TABLE = 'current_listings';
const PREVIOUS_LISTINGS_TABLE = 'previous_listings';

async function recoverCity(cityName, runId) {
  console.log(`🚀 Starting recovery for ${cityName}...`);
  
  // Find the city
  const city = getAllCities().find(c => c.name === cityName);
  if (!city) {
    console.error(`❌ City ${cityName} not found in regions`);
    process.exit(1);
  }
  
  console.log(`📍 Found city: ${city.name} in region: ${city.region}`);
  
  const cityListings = [];
  let pagesScraped = 0;
  
  // Scrape all pages for the city
  for (let page = 1; page <= 20; page++) {
    console.log(`📍 Fetching ${cityName} page ${page}...`);
    
    const listings = await fetchPageWithRetries(city, page);
    
    if (listings && listings.length) {
      for (const it of listings) {
        it.__meta = { 
          areaName: city.name, 
          page, 
          runId, 
          regionName: city.region 
        };
        cityListings.push(it);
      }
      pagesScraped = page;
      console.log(`✅ ${cityName} page ${page}: ${listings.length} listings (total: ${cityListings.length})`);
    } else if (listings === null) {
      console.warn(`❌ ${cityName} page ${page}: Failed to fetch`);
    } else {
      console.log(`ℹ️  ${cityName} page ${page}: No more results`);
      break;
    }
    
    await sleep(400); // Small delay between pages
  }
  
  if (cityListings.length === 0) {
    console.error(`❌ No listings found for ${cityName}`);
    process.exit(1);
  }
  
  console.log(`\n📊 Recovery results for ${cityName}:`);
  console.log(`   - Total listings: ${cityListings.length}`);
  console.log(`   - Pages scraped: ${pagesScraped}`);
  
  // Map and validate the listings
  const mappedRows = cityListings.map(item => mapItemToRow(item, city.name, item.__meta.page, runId, city.region));
  const validRows = mappedRows.filter(row => row !== null);
  
  console.log(`📊 Validated ${mappedRows.length} rows to ${validRows.length} unique listings`);
  
  if (validRows.length === 0) {
    console.error(`❌ No valid listings to store for ${cityName}`);
    process.exit(1);
  }
  
  // Store in previous_listings (recovery mode - populate previous for comparison)
  console.log(`\n💾 Storing ${validRows.length} listings in previous_listings (recovery mode)...`);
  await upsertListingsWithValidation(validRows, PREVIOUS_LISTINGS_TABLE);
  
  console.log(`\n✅ Recovery completed for ${cityName}!`);
  console.log(`📊 Summary:`);
  console.log(`   - Listings recovered: ${validRows.length}`);
  console.log(`   - Stored in: previous_listings`);
  console.log(`   - Ready for next scrape:all run`);
  console.log(`\n💡 Next step: Run 'npm run scrape:all' to detect changes`);
}

// Main execution
const cityName = process.argv[2];

if (!cityName) {
  console.error('❌ Please provide a city name');
  console.error('Usage: node scripts/recover-city.js <city-name>');
  console.error('Example: node scripts/recover-city.js Toronto');
  process.exit(1);
}

const runId = `recovery-${Date.now()}`;

recoverCity(cityName, runId)
  .then(() => {
    console.log('\n🎉 City recovery completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Recovery failed:', error);
    process.exit(1);
  });

