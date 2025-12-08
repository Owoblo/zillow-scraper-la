// rapidapi-scraper.js - RapidAPI-based Real Estate Scraper
import dotenv from 'dotenv';
dotenv.config();
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { sendScrapeNotification } from "./emailService.js";
import { REGIONS, getAllCities, getCitiesForRegion, getRegionKeys } from "./config/regions-rapidapi.js";

// Supabase setup
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// RapidAPI Configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'fad289c8b7msh67ab38f37446aedp1132acjsnc18eaf48b653';
const RAPIDAPI_HOST = 'us-real-estate-data.p.rapidapi.com';

// Database tables
const CURRENT_LISTINGS_TABLE = "current_listings";
const PREVIOUS_LISTINGS_TABLE = "previous_listings";
const JUST_LISTED_TABLE = "just_listed";
const SOLD_LISTINGS_TABLE = "sold_listings";

// Configuration
const UPSERT_BATCH_SIZE = 200;
const MAX_PAGES_PER_CITY = 20;
const PAGE_DELAY_MS = 1000; // 1 second between pages
const UPSERT_RETRIES = 3;

/**
 * Map RapidAPI response to our database schema
 */
function mapRapidAPIToRow(item, cityName, page, runId, regionName = null) {
  const zpid = item?.zpid;

  if (!zpid) {
    console.warn(`Skipping listing without zpid in ${cityName}`);
    return null;
  }

  // Validate numeric fields
  const validateNumeric = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  // Build lat/long object
  const latObj = {
    latitude: item?.latitude ?? null,
    longitude: item?.longitude ?? null,
  };

  return {
    // Required unique key
    zpid,

    // Run tracking
    lastrunid: runId,
    lastseenat: new Date().toISOString(),
    lastcity: cityName,
    lastpage: Number.isFinite(page) && page > 0 ? page : null,
    isjustlisted: page <= 4,

    // Regional identification
    city: cityName,
    region: regionName,

    // Status fields
    rawhomestatuscd: item?.homeStatus ?? null,
    marketingstatussimplifiedcd: item?.homeStatus ?? null,
    statustype: item?.homeStatus ?? null,
    statustext: item?.homeStatusForHDP ?? null,

    // Images
    imgsrc: item?.imgSrc ?? null,
    hasimage: item?.imgSrc ? true : null,

    // URL - construct Zillow detail URL from zpid
    detailurl: zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null,

    // Currency
    countrycurrency: item?.currency ?? 'USD',

    // Price fields
    price: item?.price ? `$${item.price.toLocaleString()}` : null,
    unformattedprice: item?.price ?? item?.priceForHDP ?? null,

    // Address fields
    address: item?.streetAddress ?? null,
    addressstreet: item?.streetAddress ?? null,
    addresszipcode: item?.zipcode ?? null,
    addresscity: item?.city ?? null,
    addressstate: item?.state ?? null,
    isundisclosedaddress: false,

    // Property details
    beds: validateNumeric(item?.bedrooms),
    baths: validateNumeric(item?.bathrooms),
    area: validateNumeric(item?.livingArea),

    // JSONB fields
    latlong: JSON.stringify(latObj),
    hdpdata: null, // RapidAPI doesn't provide hdpData
    carouselphotos: null,

    // Boolean fields
    iszillowowned: item?.isZillowOwned ?? null,
    issaved: false,
    isuserclaimingowner: false,
    isuserconfirmedclaim: false,
    shouldshowzestimateasprice: false,
    has3dmodel: item?.is3dHome ?? null,

    // Additional fields
    flexfieldtext: null,
    contenttype: item?.homeType ?? null,
    pgapt: item?.unit ?? null,
    sgapt: null,
    list: null,
    info1string: `${item?.bedrooms ?? 0} bd, ${item?.bathrooms ?? 0} ba`,
    brokername: null,
    openhousedescription: item?.openHouse ?? null,
    buildername: null,
    hasvideo: false,
    ispropertyresultcdp: false,
    lotareastring: item?.lotAreaValue ? `${Math.floor(item.lotAreaValue)} ${item?.lotAreaUnit ?? 'sqft'}` : null,
    providerlistingid: null,
    streetviewmetadataurl: null,
    streetviewurl: null,

    // Timestamps
    openhousestartdate: item?.open_house_info?.open_house_showing?.[0]?.open_house_start
      ? new Date(item.open_house_info.open_house_showing[0].open_house_start).toISOString()
      : null,
    openhouseenddate: item?.open_house_info?.open_house_showing?.[0]?.open_house_end
      ? new Date(item.open_house_info.open_house_showing[0].open_house_end).toISOString()
      : null,
    availability_date: null,

    // Additional JSONB fields
    carousel_photos_composable: null,
  };
}

/**
 * Fetch listings from RapidAPI
 */
async function fetchRapidAPIListings(cityName, stateName, page = 1) {
  const location = `${cityName}, ${stateName}`;

  const params = new URLSearchParams({
    location: location,
    output: 'json',
    status: 'forSale',
    sortSelection: 'priorityscore',
    listing_type: 'by_agent',
    doz: 'any',
    page: page
  });

  const url = `https://${RAPIDAPI_HOST}/search?${params.toString()}`;

  console.log(`  📡 Fetching page ${page} for ${location}...`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`RapidAPI error! status: ${response.status}`);
  }

  const data = await response.json();

  return {
    listings: data.results || [],
    totalPages: data.totalPages || 1,
    totalResults: data.totalResultCount || 0,
    resultsPerPage: data.resultsPerPage || 0
  };
}

/**
 * Upsert listings with validation and batching
 */
async function upsertListingsWithValidation(mappedRows, tableName) {
  const validRows = mappedRows.filter((r) => {
    if (!r || !r.zpid) {
      console.warn(`Skipping invalid row:`, r);
      return false;
    }
    return true;
  });

  if (validRows.length === 0) {
    console.log(`No valid rows to upsert for ${tableName}`);
    return;
  }

  // Deduplicate by zpid
  const uniqueRows = Array.from(
    new Map(validRows.map(row => [row.zpid, row])).values()
  );

  console.log(`  📊 Upserting ${uniqueRows.length} unique listings to ${tableName}...`);

  const totalBatches = Math.ceil(uniqueRows.length / UPSERT_BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const start = b * UPSERT_BATCH_SIZE;
    const end = start + UPSERT_BATCH_SIZE;
    const batch = uniqueRows.slice(start, end);

    let attempt = 0;
    let success = false;

    while (attempt < UPSERT_RETRIES && !success) {
      attempt++;
      try {
        const { error } = await supabase.from(tableName).upsert(batch, {
          onConflict: "zpid",
          ignoreDuplicates: false,
        });

        if (error) throw error;

        console.log(`    ✅ Batch ${b + 1}/${totalBatches} upserted (${batch.length} rows)`);
        success = true;
      } catch (err) {
        console.error(`    ❌ Batch ${b + 1} attempt ${attempt} failed:`, err.message);
        if (attempt >= UPSERT_RETRIES) {
          throw new Error(`Failed to upsert batch ${b + 1} after ${UPSERT_RETRIES} attempts`);
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

/**
 * Scrape a single city
 */
async function scrapeCity(cityConfig, regionName, runId) {
  const cityName = cityConfig.name;
  const stateName = cityConfig.state || 'CA'; // Default to CA if not specified

  console.log(`\n🏙️  Scraping ${cityName}, ${stateName} (Region: ${regionName})...`);

  let allListings = [];
  let totalResults = 0;
  let totalPages = 0;

  try {
    // Fetch first page to get total count
    const firstPage = await fetchRapidAPIListings(cityName, stateName, 1);
    allListings = firstPage.listings;
    totalResults = firstPage.totalResults;
    totalPages = Math.min(firstPage.totalPages, MAX_PAGES_PER_CITY);

    console.log(`  📊 Found ${totalResults} total listings, ${totalPages} pages`);

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));

      const pageData = await fetchRapidAPIListings(cityName, stateName, page);
      allListings = allListings.concat(pageData.listings);

      console.log(`  ✅ Page ${page}/${totalPages} - ${pageData.listings.length} listings`);
    }

    // Map to database schema
    const mappedRows = allListings.map((item, idx) =>
      mapRapidAPIToRow(item, cityName, Math.floor(idx / 41) + 1, runId, regionName)
    );

    // Upsert to database
    await upsertListingsWithValidation(mappedRows, CURRENT_LISTINGS_TABLE);

    console.log(`  ✅ ${cityName} complete: ${allListings.length} listings saved`);

    return {
      city: cityName,
      success: true,
      listingsCount: allListings.length,
      totalResults: totalResults
    };

  } catch (error) {
    console.error(`  ❌ Error scraping ${cityName}:`, error.message);
    return {
      city: cityName,
      success: false,
      error: error.message
    };
  }
}

/**
 * Scrape all cities in a region
 */
async function scrapeRegion(regionKey) {
  const runId = uuidv4();
  const region = REGIONS[regionKey];

  if (!region) {
    console.error(`❌ Region '${regionKey}' not found`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌎 Starting scrape for region: ${region.name}`);
  console.log(`   Run ID: ${runId}`);
  console.log(`   Cities: ${region.cities.length}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  const results = [];

  for (const cityConfig of region.cities) {
    const result = await scrapeCity(cityConfig, region.name, runId);
    results.push(result);

    // Small delay between cities
    await new Promise(r => setTimeout(r, 2000));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalListings = results.reduce((sum, r) => sum + (r.listingsCount || 0), 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Region ${region.name} Complete!`);
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Cities: ${successful} successful, ${failed} failed`);
  console.log(`   Total Listings: ${totalListings}`);
  console.log(`${'='.repeat(60)}\n`);

  // Send email notification
  try {
    await sendScrapeNotification({
      region: region.name,
      citiesScraped: successful,
      totalListings: totalListings,
      duration: duration,
      runId: runId,
      results: results
    });
  } catch (emailError) {
    console.error('Failed to send email notification:', emailError.message);
  }

  return results;
}

/**
 * Scrape all regions
 */
async function scrapeAllRegions() {
  const regionKeys = getRegionKeys();
  console.log(`\n🌍 Scraping all ${regionKeys.length} regions...`);

  for (const regionKey of regionKeys) {
    await scrapeRegion(regionKey);
    // Delay between regions
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n✅ All regions complete!`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'region' && args[1]) {
  scrapeRegion(args[1]).catch(console.error);
} else if (command === 'all') {
  scrapeAllRegions().catch(console.error);
} else if (command === 'city' && args[1]) {
  // Single city test
  const runId = uuidv4();
  const [cityName, stateName = 'CA'] = args[1].split(',').map(s => s.trim());
  scrapeCity({ name: cityName, state: stateName }, 'Test', runId).catch(console.error);
} else {
  console.log(`
Usage:
  node rapidapi-scraper.js city "San Francisco, CA"   - Test single city
  node rapidapi-scraper.js region bay_area             - Scrape one region
  node rapidapi-scraper.js all                         - Scrape all regions
  `);
}
