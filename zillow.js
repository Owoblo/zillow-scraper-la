// zillow.js - Real-time Zillow Scraper with Email Notifications
import dotenv from 'dotenv';
dotenv.config();
import fetch from "node-fetch";
import fs from "graceful-fs";
import { createClient } from "@supabase/supabase-js";
import { getSmartProxyAgent } from "./proxies.js";
import { v4 as uuidv4 } from "uuid";
import { sendScrapeNotification } from "./emailService.js";
import { REGIONS, getAllCities, getCitiesForRegion, getRegionKeys } from "./config/regions.js";
// Enhanced data mapping and validation functions (integrated from scraper-improvements.js)


 
 const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co'; 
 const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
 

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Tunables
const CURRENT_LISTINGS_TABLE = "current_listings";
const PREVIOUS_LISTINGS_TABLE = "previous_listings";
const JUST_LISTED_TABLE = "just_listed";
const SOLD_LISTINGS_TABLE = "sold_listings";
const UPSERT_BATCH_SIZE = 200;
const MAX_PAGES_PER_AREA = 20;   // safety cap
const PAGE_DELAY_MS = 400;       // gentle pacing
const UPSERT_RETRIES = 3;
const PAGE_RETRY_LIMIT = 3;     // how many times to retry a failing page
const SWEEP_RETRY_LIMIT = 2;    // how many "second pass" sweeps to try on failed pages
const RETRY_BASE_MS = 600;      // base backoff

// Regional processing configuration
const MAX_CONCURRENT_REGIONS = 2; // Process up to 3 regions concurrently
const REGION_DELAY_MS = 2000; // 2 second delay between region starts

// Ultimate Data Quality & Integrity System
const CITY_DATA_QUALITY_THRESHOLD = 0.8; // 80% success rate required
const MAX_CITY_RETRY_ATTEMPTS = 3;
const DATA_VALIDATION_ENABLED = true;

// Track data quality per city
const cityDataQuality = new Map();
const failedCities = new Set();
const successfulCities = new Set();

// Enhanced data mapping and validation functions (integrated from scraper-improvements.js)

/**
 * Enhanced mapItemToRow with data validation and consistent naming
 * This ensures data integrity and proper mapping to database schema
 */
function mapItemToRow(item, areaName, page, runId, regionName = null) {
  // Validate required fields
  const zpid = item?.zpid ?? item?.hdpData?.homeInfo?.zpid ?? null;
  
  if (!zpid) {
    console.warn(`Skipping listing without zpid in ${areaName}:`, {
      item: JSON.stringify(item, null, 2),
      areaName,
      page
    });
  return null;
}

  // Validate numeric fields
  const validateNumeric = (value, fieldName) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  // Validate price fields
  const price = item?.price ?? null;
  const unformattedPrice = typeof item?.unformattedPrice === "number" 
    ? item.unformattedPrice 
    : null;

  // Build a compact lat/long object for jsonb "latlong"
  const latObj = {
    latitude: item?.latLong?.latitude ?? item?.lat ?? item?.hdpData?.homeInfo?.latitude ?? null,
    longitude: item?.latLong?.longitude ?? item?.lng ?? item?.hdpData?.homeInfo?.longitude ?? null,
  };

  // Ensure consistent address field mapping
  const addressStreet = item?.addressStreet ?? item?.hdpData?.homeInfo?.streetAddress ?? null;
  const addressCity = item?.addressCity ?? item?.hdpData?.homeInfo?.city ?? null;
  const addressState = item?.addressState ?? item?.hdpData?.homeInfo?.state ?? null;

  return {
    // Required unique key (we upsert on this)
    zpid,
    
    // Run tracking
        lastrunid: runId,
        lastseenat: new Date().toISOString(),
        lastcity: areaName,
        lastpage: Number.isFinite(page) && page > 0 ? page : null,
        isjustlisted: page <= 4,
    
    // Regional identification
    city: areaName,
    region: regionName,

    // --- exact column names from your schema (lowercase) ---
    rawhomestatuscd: item?.rawHomeStatusCd ?? null,
    marketingstatussimplifiedcd: item?.marketingStatusSimplifiedCd ?? null,
    imgsrc: item?.imgSrc ?? null,
    hasimage: item?.hasImage ?? null,
    detailurl: item?.detailUrl ?? null,
    statustype: item?.statusType ?? item?.hdpData?.homeInfo?.homeStatus ?? null,
    statustext: item?.statusText ?? null,
    countrycurrency: item?.countryCurrency ?? null,

    // Price fields - ensure consistent mapping
    price: price, // text field
    unformattedprice: unformattedPrice, // numeric field
    
    // Address fields - ensure consistent mapping
    address: item?.address ?? addressStreet ?? null,
    addressstreet: addressStreet, // This maps to addressStreet in frontend
    addresszipcode: item?.addressZipcode ?? item?.hdpData?.homeInfo?.zipcode ?? null,
    isundisclosedaddress: item?.isUndisclosedAddress ?? null,
    addresscity: addressCity, // This maps to addresscity in frontend
    addressstate: addressState, // This maps to addressstate in frontend
    
    // Numeric fields with validation
    beds: validateNumeric(item?.beds ?? item?.hdpData?.homeInfo?.bedrooms, 'beds'),
    baths: validateNumeric(item?.baths ?? item?.hdpData?.homeInfo?.bathrooms, 'baths'),
    area: validateNumeric(item?.area, 'area'),
    
    // JSONB fields (stringify)
    latlong: JSON.stringify(latObj),
    hdpdata: item?.hdpData ? JSON.stringify(item.hdpData) : null,
    carouselphotos: item?.carouselPhotos ? JSON.stringify(item.carouselPhotos) : null,

    // Boolean fields
    iszillowowned: item?.isZillowOwned ?? null,
    issaved: item?.isSaved ?? null,
    isuserclaimingowner: item?.isUserClaimingOwner ?? null,
    isuserconfirmedclaim: item?.isUserConfirmedClaim ?? null,
    shouldshowzestimateasprice: item?.shouldShowZestimateAsPrice ?? null,
    has3dmodel: item?.has3dModel ?? null,

    // String fields
    flexfieldtext: item?.flexFieldText ?? null,
    contenttype: item?.contentType ?? null,
    pgapt: item?.pgapt ?? null,
    sgapt: item?.sgapt ?? null,
    list: item?.list ?? null,
    info1string: item?.info1String ?? null,
    brokername: item?.brokerName ?? null,
    openhousedescription: item?.openHouseDescription ?? null,
    buildername: item?.builderName ?? null,
    hasvideo: item?.hasVideo ?? null,
    ispropertyresultcdp: item?.isPropertyResultCDP ?? null,
    lotareastring: item?.lotAreaString ?? null,
    providerlistingid: item?.providerListingId ?? null,
    streetviewmetadataurl: item?.streetViewMetadataURL ?? null,
    streetviewurl: item?.streetViewURL ?? null,

    // Timestamps
    openhousestartdate: item?.openHouseStartDate ?? null,
    openhouseenddate: item?.openHouseEndDate ?? null,
    availability_date: item?.availabilityDate ?? null,

    // Additional JSONB fields
    carousel_photos_composable: item?.carouselPhotosComposable
      ? JSON.stringify(item.carouselPhotosComposable)
      : null,
  };
}

/**
 * Enhanced upsert function with better error handling and validation
 */
async function upsertListingsWithValidation(mappedRows, tableName) {
  // Filter out null rows and validate data
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

  // Deduplicate by zpid - keep the last occurrence of each zpid
  const uniqueRows = Array.from(
    new Map(validRows.map(row => [row.zpid, row])).values()
  );
  
  console.log(`📊 Validated and deduplicated ${validRows.length} rows to ${uniqueRows.length} unique listings for ${tableName}`);

  const totalBatches = Math.ceil(uniqueRows.length / UPSERT_BATCH_SIZE);
  console.log(`📦 Processing ${uniqueRows.length} listings in ${totalBatches} batches of ${UPSERT_BATCH_SIZE}...`);

  for (let i = 0; i < uniqueRows.length; i += UPSERT_BATCH_SIZE) {
    const slice = uniqueRows.slice(i, i + UPSERT_BATCH_SIZE);
    let attempt = 0;
    let lastErr = null;

    while (attempt < UPSERT_RETRIES) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .upsert(slice, { onConflict: "zpid" });

        if (error) {
          // Log detailed error information
          console.error(`Upsert error for ${tableName}:`, {
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            batchSize: slice.length,
            batchNumber: Math.floor(i / UPSERT_BATCH_SIZE) + 1
          });
          throw error;
        }

        const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
        console.log(
          `✅ Upserted ${slice.length} rows into ${tableName} (batch ${batchNumber}/${totalBatches})`
        );
        
        // Small delay between batches to prevent overwhelming the database
        if (i + UPSERT_BATCH_SIZE < uniqueRows.length) {
          await sleep(100);
        }
        break;
      } catch (err) {
        lastErr = err;
        attempt++;
        const wait = 500 * attempt ** 2;
        console.warn(`❌ Upsert attempt ${attempt} failed for ${tableName}: ${err.message}. Retry in ${wait}ms`);
        await sleep(wait);
      }
    }
    
    if (lastErr && attempt === UPSERT_RETRIES) {
      console.error(`💥 Upsert failed after ${UPSERT_RETRIES} retries for ${tableName}:`, lastErr);
      // Continue with next batch instead of failing completely
    }
  }
}

/**
 * Enhanced data validation for listings before storage
 */
function validateListingData(listing) {
  const errors = [];
  
  // Required fields
  if (!listing.zpid) errors.push('Missing zpid');
  
  // Validate numeric fields
  if (listing.beds !== null && (listing.beds < 0 || listing.beds > 20)) {
    errors.push(`Invalid beds value: ${listing.beds}`);
  }
  
  if (listing.baths !== null && (listing.baths < 0 || listing.baths > 20)) {
    errors.push(`Invalid baths value: ${listing.baths}`);
  }
  
  if (listing.area !== null && (listing.area < 0 || listing.area > 100000)) {
    errors.push(`Invalid area value: ${listing.area}`);
  }
  
  if (listing.unformattedprice !== null && (listing.unformattedprice < 0 || listing.unformattedprice > 100000000)) {
    errors.push(`Invalid price value: ${listing.unformattedprice}`);
  }
  
  // Validate address fields
  if (!listing.addressstreet && !listing.address) {
    errors.push('Missing address information');
  }
  
  if (!listing.addresscity) {
    errors.push('Missing city information');
  }
  
  if (!listing.addressstate) {
    errors.push('Missing state information');
  }
  
  if (errors.length > 0) {
    console.warn(`Data validation errors for listing ${listing.zpid}:`, errors);
    return false;
  }
  
  return true;
}


// Enhanced retry system for incomplete data collection
async function fetchPageWithEnhancedRetries(area, page, maxRetries = 5) {
  const retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fetchPageWithRetries(area, page);
      
      if (result && result.listResults && result.listResults.length > 0) {
        return result;
      } else if (page <= 3) {
        // If we're on early pages and get no results, this might be incomplete data
        console.log(`⚠️  ${area} page ${page}: No results on early page - might be incomplete data`);
        if (attempt < maxRetries - 1) {
          console.log(`🔄 Retrying ${area} page ${page} with enhanced strategy (attempt ${attempt + 2}/${maxRetries})...`);
          await sleep(retryDelays[attempt]);
          continue;
        }
      }
      
      return result;
    } catch (error) {
      console.log(`${area} p${page} fetch attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt < maxRetries - 1) {
        console.log(`🔄 Retrying in ${retryDelays[attempt]}ms...`);
        await sleep(retryDelays[attempt]);
      } else {
        console.log(`❌ ${area} page ${page}: All retry attempts failed`);
        return null;
      }
    }
  }
  
  return null;
}

// Data quality tracking functions
function trackCitySuccess(cityName, listingsCount, expectedMin = 20, pagesScraped = 0) {
  // City-specific expected listing counts based on real market data
  const cityExpectations = {
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
    'Amherstburg': 200
  };
  
  const expected = cityExpectations[cityName] || expectedMin;
  const quality = Math.min(listingsCount / expected, 1.0);
  
  // NEW: Page count validation - any city that doesn't reach page 20 should be retried
  if (pagesScraped < 20) {
    console.log(`⚠️  ${cityName}: INCOMPLETE PAGES - Only ${pagesScraped} pages scraped (expected 20)`);
    console.log(`💡 This city should be retried for complete data collection`);
    cityDataQuality.set(cityName, quality);
    failedCities.add(cityName);
    successfulCities.delete(cityName);
    return false;
  }
  
  // Flag suspiciously low data (less than 30% of expected)
  if (listingsCount < expected * 0.3) {
    console.log(`🚨 ${cityName}: SUSPICIOUSLY LOW DATA - ${listingsCount} listings (expected ~${expected})`);
    console.log(`💡 This city needs immediate retry - data collection likely failed`);
    cityDataQuality.set(cityName, 0);
    failedCities.add(cityName);
    successfulCities.delete(cityName);
    return false;
  }
  
  // Flag incomplete data (less than 70% of expected)
  if (listingsCount < expected * 0.7) {
    console.log(`⚠️  ${cityName}: INCOMPLETE DATA - ${listingsCount} listings (expected ~${expected})`);
    console.log(`💡 This city should be retried for better data quality`);
    cityDataQuality.set(cityName, quality);
    failedCities.add(cityName);
    successfulCities.delete(cityName);
    return false;
  }
  
  // Good data quality
  cityDataQuality.set(cityName, quality);
  successfulCities.add(cityName);
  failedCities.delete(cityName);
  
  console.log(`✅ ${cityName}: Data quality ${(quality * 100).toFixed(1)}% (${listingsCount} listings, ${pagesScraped} pages)`);
  return quality >= CITY_DATA_QUALITY_THRESHOLD;
}

function trackCityFailure(cityName, reason) {
  failedCities.add(cityName);
  successfulCities.delete(cityName);
  cityDataQuality.set(cityName, 0);
  
  console.log(`❌ ${cityName}: Data collection failed - ${reason}`);
}

function getCitiesNeedingRetry() {
  return Array.from(failedCities);
}

function getSuccessfulCities() {
  return Array.from(successfulCities);
}

function getDataQualityReport() {
  const report = {
    totalCities: cityDataQuality.size,
    successful: successfulCities.size,
    failed: failedCities.size,
    averageQuality: Array.from(cityDataQuality.values()).reduce((a, b) => a + b, 0) / cityDataQuality.size || 0
  };
  
  console.log(`\n📈 DATA QUALITY REPORT:`);
  console.log(`   Total Cities: ${report.totalCities}`);
  console.log(`   Successful: ${report.successful} (${((report.successful/report.totalCities)*100).toFixed(1)}%)`);
  console.log(`   Failed: ${report.failed} (${((report.failed/report.totalCities)*100).toFixed(1)}%)`);
  console.log(`   Average Quality: ${(report.averageQuality*100).toFixed(1)}%`);
  
  return report;
}


// Add this helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

function coerceIntOrNull(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.trunc(x);
}

// ----- Run tracking -----
async function startRun() {
  const runId = uuidv4();
  const { error } = await supabase.from("runs").insert([{ id: runId }]);
  if (error) throw error;
  return runId;
}

async function endRun(runId) {
  await supabase.from("runs").update({ ended_at: nowIso() }).eq("id", runId);
}

async function getPrevRunId(currentRunId) {
  const { data, error } = await supabase
    .from("runs")
    .select("id, started_at")
    .order("started_at", { ascending: false })
    .limit(2);

  if (error) throw error;
  if (!data?.length) return null;
  // data[0] should be current run; data[1] is prev if it exists
  if (data[0]?.id === currentRunId) return data[1]?.id ?? null;
  // in rare ordering edge-cases, fall back to “the other one”
  return data.find((r) => r.id !== currentRunId)?.id ?? null;
}

async function fetchPageWithRetries(area, page) {
  let attempt = 0;
  while (attempt < PAGE_RETRY_LIMIT) {
    attempt++;
    try {
      // Add a small random delay to make requests more realistic
      const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
      await sleep(randomDelay);
      
      const listings = await fetchSearchPage(area, page); // your existing function
      // If Zillow returns HTML or empty due to a hiccup, treat as retryable
      if (!Array.isArray(listings)) throw new Error("Non-array listings");
      return listings;
    } catch (e) {
      const wait = RETRY_BASE_MS * attempt ** 2;
      console.warn(
        `${area.name} p${page} fetch attempt ${attempt} failed: ${e.message}. Retrying in ${wait}ms`
      );
      await sleep(wait);
    }
  }
  // Give up for now. We'll try again in the sweep.
  return null;
}


/**
 * Map a Zillow listResults item → row matching public.listings1
 * Notes:
 * - Do NOT include `id` (auto identity)
 * - Upsert on `zpid`
 * - JSONB columns are stringified
 * - Keep to your existing column names (mostly lowercase)
 */
// ✅ Replace your existing mapItemToRow with this version
// mapItemToRow function now imported from scraper-improvements.js

// upsertListingsWithValidation function now imported from scraper-improvements.js

// Real-time listing detection functions
async function detectJustListedAndSold() {
  console.log("\n🔍 Detecting just-listed and sold listings...");
  
  try {
    // Get current and previous listings
    const { data: currentListings, error: currentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select("*");
    
    if (currentError) throw currentError;

    const { data: previousListings, error: prevError } = await supabase
      .from(PREVIOUS_LISTINGS_TABLE)
      .select("*");
    
    if (prevError) throw prevError;

    // Create sets for efficient comparison
    const currentZpidSet = new Set(currentListings.map(l => l.zpid));
    const previousZpidSet = new Set(previousListings.map(l => l.zpid));

    // Find just-listed (in current but not in previous)
    const justListed = currentListings.filter(listing => !previousZpidSet.has(listing.zpid));
    
    // Find sold (in previous but not in current)
    const soldListings = previousListings.filter(listing => !currentZpidSet.has(listing.zpid));

    console.log(`📊 Found ${justListed.length} just-listed and ${soldListings.length} sold listings`);

    // Only store if we have new data
    if (justListed.length > 0) {
      console.log(`📦 Storing ${justListed.length} just-listed listings in batches...`);
      await upsertListingsWithValidation(justListed, JUST_LISTED_TABLE);
      console.log(`✅ Stored ${justListed.length} just-listed listings`);
    } else {
      console.log("ℹ️  No new just-listed listings to store");
    }

    if (soldListings.length > 0) {
      console.log(`📦 Storing ${soldListings.length} sold listings in batches...`);
      await upsertListingsWithValidation(soldListings, SOLD_LISTINGS_TABLE);
      console.log(`✅ Stored ${soldListings.length} sold listings`);
    } else {
      console.log("ℹ️  No sold listings detected");
    }

    return { justListed, soldListings };
  } catch (error) {
    console.error("❌ Error detecting listings:", error);
    throw error;
  }
}

// City-specific retry system for maximum data accuracy
async function retryFailedCities(runId) {
  const citiesToRetry = getCitiesNeedingRetry();
  
  if (citiesToRetry.length === 0) {
    console.log(`\n✅ No cities need retry - all data collection successful!`);
    return [];
  }
  
  console.log(`\n🔄 Retrying ${citiesToRetry.length} failed cities...`);
  
  const retryResults = [];
  const stillFailedCities = [];
  
  // First batch of retries (existing logic)
  for (const cityName of citiesToRetry) {
    console.log(`\n🔍 Retrying ${cityName}...`);
    
    const city = getAllCities().find(c => c.name === cityName);
    if (!city) {
      console.error(`❌ City ${cityName} not found in regions`);
      continue;
    }
    
    const cityListings = [];
    let retryAttempts = 0;
    let maxRetryAttempts = MAX_CITY_RETRY_ATTEMPTS;
    
    while (retryAttempts < maxRetryAttempts) {
      retryAttempts++;
      console.log(`🔄 Retry attempt ${retryAttempts}/${maxRetryAttempts} for ${cityName}`);
      
      let pagesScraped = 0;
      for (let page = 1; page <= MAX_PAGES_PER_AREA; page++) {
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
          console.log(`✅ ${cityName} p${page}: ${listings.length} listings`);
        } else if (listings === null) {
          console.warn(`❌ ${cityName} p${page}: Still failing`);
        } else {
          console.log(`ℹ️  ${cityName} p${page}: No more results`);
          break;
        }
        
        await sleep(PAGE_DELAY_MS);
      }
      
      // Check if this retry was successful
      if (trackCitySuccess(cityName, cityListings.length, 20, pagesScraped)) {
        console.log(`✅ ${cityName} retry successful: ${cityListings.length} listings`);
        retryResults.push(...cityListings);
        break;
      } else {
        console.warn(`⚠️  ${cityName} retry ${retryAttempts} still low quality: ${cityListings.length} listings`);
        if (retryAttempts < maxRetryAttempts) {
          console.log(`⏳ Waiting before next retry...`);
          await sleep(PAGE_DELAY_MS * 3);
        }
      }
    }
    
    if (!successfulCities.has(cityName)) {
      console.error(`❌ ${cityName} failed after ${maxRetryAttempts} retry attempts`);
      stillFailedCities.push(cityName);
    }
  }
  
  // Extended retry batch for still-failed cities
  if (stillFailedCities.length > 0) {
    console.log(`\n🔄 Extended retry batch for ${stillFailedCities.length} stubborn cities...`);
    console.log(`📍 Cities: ${stillFailedCities.join(', ')}`);
    
    for (const cityName of stillFailedCities) {
      console.log(`\n🔍 Extended retry for ${cityName}...`);
      
      const city = getAllCities().find(c => c.name === cityName);
      if (!city) {
        console.error(`❌ City ${cityName} not found in regions`);
        continue;
      }
      
      const cityListings = [];
      let retryAttempts = 0;
      let maxRetryAttempts = 3; // Second batch of 3 retries
      
      while (retryAttempts < maxRetryAttempts) {
        retryAttempts++;
        console.log(`🔄 Extended retry attempt ${retryAttempts}/${maxRetryAttempts} for ${cityName}`);
        
        // Random delay between 2-5 seconds
        const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
        console.log(`⏳ Random delay: ${randomDelay}ms`);
        await sleep(randomDelay);
        
        let pagesScraped = 0;
        for (let page = 1; page <= MAX_PAGES_PER_AREA; page++) {
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
            console.log(`✅ ${cityName} p${page}: ${listings.length} listings`);
          } else if (listings === null) {
            console.warn(`❌ ${cityName} p${page}: Still failing`);
          } else {
            console.log(`ℹ️  ${cityName} p${page}: No more results`);
            break;
          }
          
          await sleep(PAGE_DELAY_MS);
        }
        
        // Check if this extended retry was successful
        if (trackCitySuccess(cityName, cityListings.length, 20, pagesScraped)) {
          console.log(`✅ ${cityName} extended retry successful: ${cityListings.length} listings`);
          retryResults.push(...cityListings);
          break;
        } else {
          console.warn(`⚠️  ${cityName} extended retry ${retryAttempts} still low quality: ${cityListings.length} listings`);
          if (retryAttempts < maxRetryAttempts) {
            console.log(`⏳ Waiting before next extended retry...`);
            await sleep(PAGE_DELAY_MS * 2);
          }
        }
      }
      
      if (!successfulCities.has(cityName)) {
        console.error(`❌ ${cityName} failed after extended retry attempts`);
      }
    }
  }
  
  return retryResults;
}

// Enhanced diagnostic function to check table status
async function diagnoseTableStatus() {
  console.log("\n🔍 Diagnosing table status for sold detection...");
  
  try {
    // Check current table counts
    const { count: currentCount, error: currentCountError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select('*', { count: 'exact', head: true });
    
    if (currentCountError) throw currentCountError;
    
    // Check previous table counts
    const { count: previousCount, error: prevCountError } = await supabase
      .from(PREVIOUS_LISTINGS_TABLE)
      .select('*', { count: 'exact', head: true });
    
    if (prevCountError) throw prevCountError;
    
    console.log(`📊 Current table: ${currentCount} total records`);
    console.log(`📊 Previous table: ${previousCount} total records`);
    
    if (previousCount === 0) {
      console.log(`⚠️  Previous table is EMPTY - this explains why no sold listings were detected!`);
      console.log(`💡 This is normal for the first run after table switching was fixed`);
      return;
    }
    
    // Get sample data for analysis
    const { data: currentData, error: currentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select('zpid, city, lastseenat')
      .limit(10);
    
    if (currentError) throw currentError;
    
    const { data: previousData, error: prevError } = await supabase
      .from(PREVIOUS_LISTINGS_TABLE)
      .select('zpid, city, lastseenat')
      .limit(10);
    
    if (prevError) throw prevError;
    
    console.log(`📊 Sample current data: ${currentData.length} records`);
    console.log(`📊 Sample previous data: ${previousData.length} records`);
    
    // Check if tables have different data
    if (currentData.length > 0 && previousData.length > 0) {
      const currentZpidSet = new Set(currentData.map(l => l.zpid));
      const previousZpidSet = new Set(previousData.map(l => l.zpid));
      const potentialSold = previousData.filter(l => !currentZpidSet.has(l.zpid));
      console.log(`📊 Potential sold listings in sample: ${potentialSold.length}`);
      
      if (potentialSold.length > 0) {
        console.log(`📋 Sample sold listings:`);
        potentialSold.slice(0, 3).forEach((listing, index) => {
          console.log(`  ${index + 1}. ZPID: ${listing.zpid} - ${listing.city} (${listing.lastseenat})`);
        });
      }
    }
    
    // Check for city-level differences
    const currentCities = [...new Set(currentData.map(l => l.city))];
    const previousCities = [...new Set(previousData.map(l => l.city))];
    console.log(`📊 Current cities in sample: ${currentCities.join(', ')}`);
    console.log(`📊 Previous cities in sample: ${previousCities.join(', ')}`);
    
  } catch (error) {
    console.error("❌ Error diagnosing table status:", error);
  }
}

// City-level detection for maximum accuracy
async function detectJustListedAndSoldByCity(cityName) {
  console.log(`\n🔍 Detecting changes for ${cityName}...`);
  
  const maxRetries = 3;
  const retryDelays = [2000, 5000, 10000]; // Progressive delays for timeouts
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get current listings for this specific city
    const { data: currentListings, error: currentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
        .select("*")
        .eq('city', cityName);
    
    if (currentError) throw currentError;

      // Get previous listings for this specific city
      const { data: previousListings, error: prevError } = await supabase
        .from(PREVIOUS_LISTINGS_TABLE)
        .select("*")
        .eq('city', cityName);
      
      if (prevError) throw prevError;

      // Enhanced logging for sold detection analysis
      console.log(`📊 ${cityName}: Current=${currentListings.length}, Previous=${previousListings.length}`);
      
      if (previousListings.length === 0) {
        console.log(`⚠️  ${cityName}: Previous table is empty - this might be the first run or table switching failed`);
        return { justListed: [], soldListings: [] };
      }

      // Pure city-to-city comparison
      const currentZpidSet = new Set(currentListings.map(l => l.zpid));
      const previousZpidSet = new Set(previousListings.map(l => l.zpid));
      
      // Find just-listed (in current but not in previous)
      const justListed = currentListings.filter(listing => !previousZpidSet.has(listing.zpid));
      
      // Find sold (in previous but not in current)
      const soldListings = previousListings.filter(listing => !currentZpidSet.has(listing.zpid));
      
      console.log(`📊 ${cityName}: ${justListed.length} just-listed, ${soldListings.length} sold`);
      
      // Enhanced sold detection logging
      if (soldListings.length > 0) {
        console.log(`📋 Sample sold listings for ${cityName}:`);
        soldListings.slice(0, 3).forEach((listing, index) => {
          console.log(`  ${index + 1}. ZPID: ${listing.zpid} - ${listing.addressstreet || listing.address} - ${listing.addresscity}`);
        });
      } else {
        // Debug: Show some sample ZPIDs to verify comparison logic
        const currentSample = currentListings.slice(0, 3).map(l => l.zpid);
        const previousSample = previousListings.slice(0, 3).map(l => l.zpid);
        console.log(`🔍 ${cityName}: Sample current ZPIDs: [${currentSample.join(', ')}]`);
        console.log(`🔍 ${cityName}: Sample previous ZPIDs: [${previousSample.join(', ')}]`);
        
        // Check if there are any overlapping ZPIDs
        const overlap = currentSample.filter(zpid => previousSample.includes(zpid));
        console.log(`🔍 ${cityName}: Overlapping ZPIDs in sample: [${overlap.join(', ')}]`);
        
        if (previousListings.length > 0) {
          console.log(`🤔 ${cityName}: No sold listings detected despite ${previousListings.length} previous listings`);
          console.log(`💡 This could mean: 1) No properties actually sold, 2) All previous listings are still current, or 3) Detection logic issue`);
        }
      }
      
      return { justListed, soldListings };
    } catch (error) {
      console.log(`❌ Error detecting changes for ${cityName} (attempt ${attempt + 1}/${maxRetries}):`, {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
        type: typeof error
      });
      
      // Check if it's a timeout error
      if (error?.code === '57014' || error?.message?.includes('timeout')) {
        console.log(`⏰ ${cityName}: Database timeout detected - will retry after other cities`);
        if (attempt < maxRetries - 1) {
          console.log(`🔄 Retrying ${cityName} in ${retryDelays[attempt]}ms...`);
          await sleep(retryDelays[attempt]);
          continue;
        } else {
          console.log(`❌ ${cityName}: All timeout retry attempts failed`);
          return { justListed: [], soldListings: [] };
        }
      } else {
        // Non-timeout error - don't retry
        console.log(`❌ ${cityName}: Non-timeout error - skipping retry`);
        return { justListed: [], soldListings: [] };
      }
    }
  }
  
  return { justListed: [], soldListings: [] };
}

async function switchTables() {
  console.log("\n🔄 Switching tables for next run...");
  
  try {
    // Use a more efficient approach: copy data in smaller chunks
    console.log("📋 Getting current listings count...");
    
    // First, get the count to see how much data we're dealing with
    const { count, error: countError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .select("*", { count: "exact", head: true });
    
    if (countError) throw countError;

    if (!count || count === 0) {
      console.log("ℹ️  No current listings to copy - skipping table switch");
      return;
    }

    console.log(`📋 Found ${count} listings to copy to previous table...`);

    // Clear previous listings table first
    console.log("🗑️  Clearing previous listings table...");
    const { error: clearPrevError } = await supabase
      .from(PREVIOUS_LISTINGS_TABLE)
      .delete()
      .neq('zpid', '');
    
    if (clearPrevError) {
      console.warn("⚠️  Warning: Could not clear previous table:", clearPrevError.message);
    } else {
      console.log("✅ Cleared previous listings table");
    }

    // Copy data in smaller batches to avoid timeout
    const batchSize = 100; // Reduced batch size for better timeout handling
    const maxRetries = 2; // Limited retries to prevent infinite loops
    let totalCopied = 0;
    let offset = 0;
    let copySuccess = true;
    
    while (totalCopied < count && copySuccess) {
      console.log(`📦 Processing batch starting at offset ${offset}...`);
      
      let batchSuccess = false;
      let retryCount = 0;
      
      // Retry logic for each batch
      while (!batchSuccess && retryCount < maxRetries) {
        try {
          // Fetch a batch of data
          const { data: batchData, error: fetchError } = await supabase
            .from(CURRENT_LISTINGS_TABLE)
            .select("*")
            .range(offset, offset + batchSize - 1);
          
          if (fetchError) {
            if (fetchError.code === '57014' || fetchError.message?.includes('timeout')) {
              console.log(`⏰ Timeout fetching batch at offset ${offset} (attempt ${retryCount + 1}/${maxRetries})`);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                continue;
              } else {
                console.error(`❌ Failed to fetch batch at offset ${offset} after ${maxRetries} attempts`);
                copySuccess = false;
                break;
              }
            }
            throw fetchError;
          }
          
          if (!batchData || batchData.length === 0) {
            console.log("ℹ️  No more data to process");
            batchSuccess = true;
            break;
          }
          
          // Insert the batch into previous table
          const { error: insertError } = await supabase
            .from(PREVIOUS_LISTINGS_TABLE)
            .insert(batchData);
          
          if (insertError) {
            if (insertError.code === '57014' || insertError.message?.includes('timeout')) {
              console.log(`⏰ Timeout inserting batch at offset ${offset} (attempt ${retryCount + 1}/${maxRetries})`);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                continue;
              } else {
                console.error(`❌ Failed to insert batch at offset ${offset} after ${maxRetries} attempts`);
                copySuccess = false;
                break;
              }
            }
            throw insertError;
          }
          
          totalCopied += batchData.length;
          const batchNumber = Math.floor(offset / batchSize) + 1;
          const totalBatches = Math.ceil(count / batchSize);
          
          console.log(`✅ Inserted batch ${batchNumber}/${totalBatches} (${batchData.length} listings) - Total: ${totalCopied}/${count}`);
          batchSuccess = true;
          
        } catch (error) {
          console.error(`❌ Error processing batch at offset ${offset} (attempt ${retryCount + 1}/${maxRetries}):`, {
            message: error?.message || 'Unknown error',
            code: error?.code || 'UNKNOWN'
          });
          
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying batch at offset ${offset} in ${1000 * retryCount}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            console.error(`❌ Failed to process batch at offset ${offset} after ${maxRetries} attempts`);
            copySuccess = false;
            break;
          }
        }
      }
      
      // Move to next batch
      offset += batchSize;
      
      // Delay between batches to prevent overwhelming the database
      if (totalCopied < count && copySuccess) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // CRITICAL: Always clear current table to prevent data corruption
    // This ensures new records can be inserted cleanly
    console.log("🗑️  Clearing current listings table...");
    const { error: clearCurrentError } = await supabase
      .from(CURRENT_LISTINGS_TABLE)
      .delete()
      .neq('zpid', '');
    
    if (clearCurrentError) {
      console.error("❌ CRITICAL: Failed to clear current table:", clearCurrentError.message);
      console.error("❌ This could cause data corruption - manual intervention required!");
      throw new Error("Failed to clear current table - manual intervention required");
    } else {
      console.log("✅ Cleared current listings table");
    }
    
    if (copySuccess) {
      console.log(`✅ Table switching completed successfully! Copied ${totalCopied} listings.`);
    } else {
      console.log(`⚠️  Table switching completed with warnings! Copied ${totalCopied}/${count} listings.`);
      console.log("⚠️  Previous table may be incomplete, but current table is cleared for new data.");
    }
    
  } catch (error) {
    console.error("❌ Error switching tables:", {
      message: error?.message || 'No message',
      code: error?.code || 'No code', 
      type: typeof error,
      error: error
    });
    
    // CRITICAL: Even if table switching fails, we MUST clear current table
    // to prevent data corruption and ensure new records can be inserted
    console.log("🔄 CRITICAL: Attempting to clear current table to prevent data corruption...");
    try {
      const { error: clearCurrentError } = await supabase
        .from(CURRENT_LISTINGS_TABLE)
        .delete()
        .neq('zpid', '');
      
      if (clearCurrentError) {
        console.error("❌ CRITICAL: Failed to clear current table:", clearCurrentError.message);
        console.error("❌ MANUAL INTERVENTION REQUIRED: Clear current_listings table manually!");
        console.error("❌ Run this SQL: DELETE FROM current_listings WHERE zpid != '';");
      } else {
        console.log("✅ Cleared current table to prevent data corruption");
      }
    } catch (clearError) {
      console.error("❌ CRITICAL: Error clearing current table:", clearError.message);
      console.error("❌ MANUAL INTERVENTION REQUIRED: Clear current_listings table manually!");
      console.error("❌ Run this SQL: DELETE FROM current_listings WHERE zpid != '';");
    }
    
    // Don't throw - this is not critical for the main functionality
    console.log("⚠️  Continuing despite table switch error...");
  }
}

async function fetchSearchPage(area, page) {
  const searchQueryState = {
    pagination: { currentPage: page },
    isMapVisible: true,
    mapBounds: area.mapBounds,
    regionSelection: [{ regionId: area.regionId, regionType: 6 }],
    filterState: {
      sortSelection: { value: "globalrelevanceex" },
      isAllHomes: { value: true },
    },
    isEntirePlaceForRent: true,
    isRoomForRent: false,
    isListVisible: true,
  };

  const res = await fetch("https://www.zillow.com/async-create-search-page-state", {
    agent: getSmartProxyAgent(),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Content-Type": "application/json",
      "Origin": "https://www.zillow.com",
      "Referer": "https://www.zillow.com/homes/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    body: JSON.stringify({
      searchQueryState,
      wants: { cat1: ["listResults", "mapResults"], cat2: ["total"] },
    }),
    method: "PUT",
  });

  const text = await res.text();
  try {
    if (text.trim().startsWith("<")) {
      console.log("Got HTML response, first 200 chars:", text.substring(0, 200));
      throw new Error("Got HTML instead of JSON");
    }
    const json = JSON.parse(text);
    const listings = json?.cat1?.searchResults?.listResults ?? [];
    return Array.isArray(listings) ? listings : [];
  } catch (e) {
    console.error("Page parse error:", e.message);
    console.log("Response status:", res.status);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    console.log("Response text (first 500 chars):", text.substring(0, 500));
    return [];
  }
}

async function getSearchResults(runId, regionKeys = null) {
  // Get cities from specified regions or all regions
  const mapBoundsList = regionKeys 
    ? regionKeys.flatMap(key => getCitiesForRegion(key))
    : getAllCities();

  const all = [];
  const failed = []; // collect { area, page } that still failed after PAGE_RETRY_LIMIT
  const cityResults = new Map(); // Track results per city

  console.log(`\n🏙️  Starting data collection for ${mapBoundsList.length} cities...`);

  for (const area of mapBoundsList) {
    console.log(`\n📍 Fetching ${area.name}...`);
    const cityListings = [];
    let cityPages = 0;
    let cityFailedPages = 0;
    let lastPage = 0;
    
    for (let page = 1; page <= MAX_PAGES_PER_AREA; page++) {
      const listings = await fetchPageWithRetries(area, page);

      if (listings === null) {
        console.warn(`${area.name}: page ${page} failed after retries. Marking for sweep.`);
        failed.push({ area, page });
        cityFailedPages++;
        continue;
      }
      if (!listings.length) {
        console.log(`No more results for ${area.name} at page ${page}.`);
        lastPage = page - 1; // Track the last successful page
        break;
      }

      // Attach meta so we can stamp it later
      for (const it of listings) {
        it.__meta = { 
          areaName: area.name, 
          page, 
          runId, 
          regionName: area.region 
        };
        all.push(it);
        cityListings.push(it);
      }

      cityPages++;
      lastPage = page; // Track the last successful page
      console.log(`${area.name}: page ${page} -> ${listings.length} listings (total: ${all.length})`);
      await sleep(PAGE_DELAY_MS);
    }
    
    // Track city data quality
    cityResults.set(area.name, {
      listings: cityListings,
      pages: cityPages,
      failedPages: cityFailedPages,
      successRate: cityPages / (cityPages + cityFailedPages) || 0
    });
    
    // Determine if city data is good enough with actual page count
    const isGoodQuality = trackCitySuccess(area.name, cityListings.length, 20, lastPage);
    if (!isGoodQuality) {
      trackCityFailure(area.name, `Low data quality: ${cityListings.length} listings, ${cityFailedPages} failed pages`);
    }
  }

  // Second-pass sweep for failed pages
  for (let sweep = 1; sweep <= SWEEP_RETRY_LIMIT && failed.length; sweep++) {
    console.log(`\nSweep ${sweep}: retrying ${failed.length} failed pages...`);
    const stillFailed = [];
    for (const { area, page } of failed) {
      const listings = await fetchPageWithRetries(area, page);
      if (listings && listings.length) {
        for (const it of listings) {
          it.__meta = { 
            areaName: area.name, 
            page, 
            runId, 
            regionName: area.region 
          };
          all.push(it);
        }
        console.log(`Recovered ${listings.length} listings for ${area.name} p${page} on sweep ${sweep}`);
      } else {
        stillFailed.push({ area, page });
      }
      await sleep(PAGE_DELAY_MS);
    }
    failed.length = 0;
    failed.push(...stillFailed);
  }

  // Deduplicate raw data by zpid before returning
  const uniqueListings = Array.from(
    new Map(all.map(item => [item.zpid || item.hdpData?.homeInfo?.zpid, item])).values()
  );
  
  console.log(`Collected listings: ${all.length} raw → ${uniqueListings.length} unique. Unrecovered pages: ${failed.length}`);
  return uniqueListings;
}

// ----- Helper functions for data access -----
async function getJustListedFromTable() {
  const { data, error } = await supabase
    .from(JUST_LISTED_TABLE)
    .select("*")
    .order("lastSeenAt", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getSoldListingsFromTable() {
  const { data, error } = await supabase
    .from(SOLD_LISTINGS_TABLE)
    .select("*")
    .order("lastSeenAt", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getListingDetails(zpid) {
  const url = `https://www.zillow.com/graphql/?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%2222f1569a25f23a90bb2445ce2fb8f7a3fcf2daedd91fa86e43e7a120a17f6b93%22%7D%7D&variables=%7B%22zpid%22%3A%22${zpid}%22%2C%22zillowPlatform%22%3A%22DESKTOP%22%2C%22altId%22%3Anull%7D`;

  const res = await fetch(url, {
    agent: getSmartProxyAgent(),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "client-id": "showcase-subapp-client",
      "content-type": "application/json",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      Referer: "https://www.zillow.com/",
      "Referrer-Policy": "unsafe-url",
    },
    method: "GET",
  });

  const json = await res.json();
  return json;
}

// ----- Verification Functions -----
const VERIFICATION_BATCH_SIZE = 2; // Reduced batch size
const VERIFICATION_DELAY_MS = 8000; // Increased delay to 8 seconds
const VERIFICATION_RETRIES = 2; // Add retry logic
const SKIP_VERIFICATION = process.env.SKIP_VERIFICATION === 'true'; // Set to skip verification

/**
 * Verify if a listing is actually sold by checking its detail URL
 */
async function verifyListingSold(listing) {
  const { zpid, detailurl, address } = listing;
  
  if (!detailurl) {
    console.log(`⚠️  No detail URL for ${zpid} - skipping verification`);
    return { verified: false, confidence: 50, reason: 'No detail URL', status: 'unknown' };
  }

  console.log(`🔍 Verifying ${zpid} at ${address}...`);

  // Retry logic for failed requests
  for (let attempt = 1; attempt <= VERIFICATION_RETRIES; attempt++) {
    try {
      const response = await fetch(detailurl, {
        agent: getSmartProxyAgent(),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1',
          'Connection': 'keep-alive',
        },
        timeout: 15000,
        redirect: 'follow',
      });

      if (response.status === 403) {
        throw new Error(`HTTP 403: Forbidden (attempt ${attempt}/${VERIFICATION_RETRIES})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const verification = analyzeListingPage(html, detailurl);
      
      console.log(`✅ ${zpid}: ${verification.reason} (confidence: ${verification.confidence}%)`);
      return verification;

    } catch (error) {
      console.warn(`❌ Verification attempt ${attempt} failed for ${zpid}: ${error.message}`);
      
      if (attempt === VERIFICATION_RETRIES) {
        // All attempts failed - use fallback analysis
        console.log(`⚠️  All verification attempts failed for ${zpid}, using fallback analysis...`);
        return analyzeListingFallback(listing);
      }
      
      // Wait before retry
      const waitTime = VERIFICATION_DELAY_MS * attempt;
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }
}

/**
 * Fallback analysis when verification fails - use listing data to make educated guess
 */
function analyzeListingFallback(listing) {
  const { zpid, statustype, statustext, price, unformattedprice } = listing;
  
  console.log(`🔍 Fallback analysis for ${zpid}...`);
  
  // Check status indicators
  const statusLower = (statustype || '').toLowerCase();
  const statusTextLower = (statustext || '').toLowerCase();
  
  // Strong sold indicators in the data
  const soldIndicators = [
    'sold',
    'off market',
    'off-market',
    'closed',
    'pending',
    'contingent'
  ];
  
  // Check if any sold indicators are present
  const hasSoldIndicator = soldIndicators.some(indicator => 
    statusLower.includes(indicator) || statusTextLower.includes(indicator)
  );
  
  // Check price patterns
  const hasPrice = price && price !== 'Price Unknown' && price !== 'N/A';
  const hasUnformattedPrice = unformattedprice && unformattedprice > 0;
  
  if (hasSoldIndicator) {
    return {
      verified: false,
      confidence: 75,
      reason: `Fallback: Status indicates sold (${statustype || statustext})`,
      status: 'sold'
    };
  } else if (hasPrice || hasUnformattedPrice) {
    return {
      verified: false,
      confidence: 60,
      reason: `Fallback: Has price but no sold indicators - likely still active`,
      status: 'active'
    };
  } else {
    return {
      verified: false,
      confidence: 50,
      reason: `Fallback: Inconclusive - no clear indicators`,
      status: 'unknown'
    };
  }
}

/**
 * Analyze the listing page HTML to determine if it's sold
 */
function analyzeListingPage(html, url) {
  const lowerHtml = html.toLowerCase();
  
  // Strong indicators that property is SOLD
  const soldIndicators = [
    'off market',
    'price unknown',
    'sold',
    'sale history',
    'off-market',
    'no longer available',
    'listing removed',
    'property not available',
    'this home is not currently for sale',
    'recently sold'
  ];
  
  // Strong indicators that property is still ACTIVE
  const activeIndicators = [
    'for sale',
    'contact agent',
    'get pre-qualified',
    'schedule a tour',
    'request info',
    'view details',
    'see more',
    'tour this home'
  ];
  
  // Check for sold indicators
  let soldScore = 0;
  let soldReasons = [];
  
  for (const indicator of soldIndicators) {
    if (lowerHtml.includes(indicator)) {
      soldScore += 1;
      soldReasons.push(indicator);
    }
  }
  
  // Check for active indicators
  let activeScore = 0;
  let activeReasons = [];
  
  for (const indicator of activeIndicators) {
    if (lowerHtml.includes(indicator)) {
      activeScore += 1;
      activeReasons.push(indicator);
    }
  }
  
  // Special check for price patterns
  const hasPricePattern = /\$[\d,]+|\bc\$\d+[\d,]*/i.test(html);
  const hasPriceUnknown = lowerHtml.includes('price unknown');
  
  if (hasPricePattern && !hasPriceUnknown) {
    activeScore += 2; // Strong indicator of active listing
    activeReasons.push('has_price');
  }
  
  if (hasPriceUnknown) {
    soldScore += 2; // Strong indicator of sold listing
    soldReasons.push('price_unknown');
  }
  
  // Decision logic
  if (soldScore > activeScore) {
    const confidence = Math.min(90 + (soldScore * 5), 100);
    return {
      verified: true,
      confidence,
      reason: `SOLD indicators: ${soldReasons.join(', ')}`,
      status: 'sold'
    };
  } else if (activeScore > soldScore) {
    return {
      verified: true,
      confidence: 95,
      reason: `ACTIVE indicators: ${activeReasons.join(', ')}`,
      status: 'active'
    };
  } else {
    // Inconclusive
    return {
      verified: false,
      confidence: 50,
      reason: `Inconclusive: sold=${soldScore}, active=${activeScore}`,
      status: 'unknown'
    };
  }
}

/**
 * Verify sold listings in batches
 */
async function verifySoldListings(soldListings) {
  if (!soldListings || soldListings.length === 0) {
    console.log('✅ No sold listings to verify');
    return { verifiedSold: 0, movedBackToActive: 0, inconclusive: 0 };
  }

  if (SKIP_VERIFICATION) {
    console.log('⏭️  Skipping verification (SKIP_VERIFICATION=true)');
    console.log(`📊 Using fallback analysis for ${soldListings.length} sold listings...`);
    
    let verifiedSold = 0;
    let movedBackToActive = 0;
    let inconclusive = 0;
    
    for (const listing of soldListings) {
      const verification = analyzeListingFallback(listing);
      const result = await updateVerificationResult(listing.zpid, verification);
      
      if (result === 'sold') verifiedSold++;
      else if (result === 'active') movedBackToActive++;
      else inconclusive++;
    }
    
    return { verifiedSold, movedBackToActive, inconclusive };
  }

  console.log(`\n🔍 Verifying ${soldListings.length} sold listings...`);
  
  let verifiedSold = 0;
  let movedBackToActive = 0;
  let inconclusive = 0;
  
  // Process in small batches to avoid overwhelming the server
  for (let i = 0; i < soldListings.length; i += VERIFICATION_BATCH_SIZE) {
    const batch = soldListings.slice(i, i + VERIFICATION_BATCH_SIZE);
    console.log(`\n📦 Verifying batch ${Math.floor(i / VERIFICATION_BATCH_SIZE) + 1}/${Math.ceil(soldListings.length / VERIFICATION_BATCH_SIZE)} (${batch.length} listings)`);
    
    for (const listing of batch) {
      const verification = await verifyListingSold(listing);
      
      // Update the database with verification results
      const result = await updateVerificationResult(listing.zpid, verification);
      
      if (result === 'sold') verifiedSold++;
      else if (result === 'active') movedBackToActive++;
      else inconclusive++;
      
      // Delay between requests
      await sleep(VERIFICATION_DELAY_MS);
    }
  }
  
  console.log(`\n✅ Verification completed!`);
  console.log(`   - Verified sold: ${verifiedSold}`);
  console.log(`   - Moved back to active: ${movedBackToActive}`);
  console.log(`   - Inconclusive: ${inconclusive}`);
  
  return { verifiedSold, movedBackToActive, inconclusive };
}

/**
 * Update database with verification result
 */
async function updateVerificationResult(zpid, verification) {
  try {
    if (verification.status === 'active') {
      // Move back to current_listings if it's actually active
      console.log(`🔄 Moving ${zpid} back to active listings...`);
      
      // Get the full listing data
      const { data: listingData } = await supabase
        .from(SOLD_LISTINGS_TABLE)
        .select('*')
        .eq('zpid', zpid)
        .single();
      
      if (listingData) {
        // Insert into current_listings
        await supabase
          .from(CURRENT_LISTINGS_TABLE)
          .upsert(listingData, { onConflict: 'zpid' });
        
        // Remove from sold_listings
        await supabase
          .from(SOLD_LISTINGS_TABLE)
          .delete()
          .eq('zpid', zpid);
        
        return 'active';
      }
    } else {
      // Update the sold listing with verification data
      await supabase
        .from(SOLD_LISTINGS_TABLE)
        .update({
          verification_status: verification.status,
          verification_confidence: verification.confidence,
          verification_reason: verification.reason,
          verified_at: new Date().toISOString()
        })
        .eq('zpid', zpid);
      
      return verification.status;
    }
  } catch (error) {
    console.error(`❌ Error updating verification for ${zpid}:`, error.message);
    return 'unknown';
  }
}

// Process a single region
async function processRegion(regionKey, runId) {
  const region = REGIONS[regionKey];
  const cities = region.cities;
  
  console.log(`\n🏙️  Processing ${region.name} (${cities.length} cities)...`);
  
  const allListings = [];
  const failed = [];
  
  for (const city of cities) {
    console.log(`\n📍 Fetching ${city.name}...`);
    const cityListings = [];
    let cityPages = 0;
    let cityFailedPages = 0;
    let lastPage = 0;
    
    for (let page = 1; page <= MAX_PAGES_PER_AREA; page++) {
      const listings = await fetchPageWithRetries(city, page);
      
      if (listings === null) {
        console.warn(`${city.name}: page ${page} failed after retries. Marking for sweep.`);
        failed.push({ city, page });
        cityFailedPages++;
        continue;
      }
      if (!listings.length) {
        console.log(`No more results for ${city.name} at page ${page}.`);
        lastPage = page - 1; // Track the last successful page
        break;
      }
      
      // Attach meta with region information
      for (const listing of listings) {
        listing.__meta = { 
          areaName: city.name, 
          page, 
          runId, 
          regionName: region.name 
        };
        allListings.push(listing);
        cityListings.push(listing);
      }
      
      cityPages++;
      lastPage = page; // Track the last successful page
      console.log(`${city.name}: page ${page} -> ${listings.length} listings (total: ${allListings.length})`);
      await sleep(PAGE_DELAY_MS);
    }
    
    // Track city data quality with actual page count
    const isGoodQuality = trackCitySuccess(city.name, cityListings.length, 20, lastPage);
    if (!isGoodQuality) {
      trackCityFailure(city.name, `Low data quality: ${cityListings.length} listings, ${cityFailedPages} failed pages`);
    }
  }
  
  // Second-pass sweep for failed pages
  for (let sweep = 1; sweep <= SWEEP_RETRY_LIMIT && failed.length; sweep++) {
    console.log(`\n🔄 Sweep ${sweep}: retrying ${failed.length} failed pages...`);
    const stillFailed = [];
    for (const { city, page } of failed) {
      const listings = await fetchPageWithRetries(city, page);
      if (listings && listings.length) {
        for (const listing of listings) {
          listing.__meta = { 
            areaName: city.name, 
            page, 
            runId, 
            regionName: region.name 
          };
          allListings.push(listing);
        }
        console.log(`Recovered ${listings.length} listings for ${city.name} p${page} on sweep ${sweep}`);
      } else {
        stillFailed.push({ city, page });
      }
      await sleep(PAGE_DELAY_MS);
    }
    failed.length = 0;
    failed.push(...stillFailed);
  }
  
  // Deduplicate by zpid
  const uniqueListings = Array.from(
    new Map(allListings.map(item => [item.zpid || item.hdpData?.homeInfo?.zpid, item])).values()
  );
  
  console.log(`✅ ${region.name}: ${allListings.length} raw → ${uniqueListings.length} unique listings`);
  return { region: regionKey, listings: uniqueListings, failed: failed.length };
}

// Process multiple regions concurrently
async function processRegionsConcurrently(runId, regionKeys = null) {
  const regionsToProcess = regionKeys || getRegionKeys();
  
  console.log(`\n🚀 Processing ${regionsToProcess.length} regions concurrently...`);
  
  const results = [];
  const batches = [];
  
  // Split regions into batches for concurrent processing
  for (let i = 0; i < regionsToProcess.length; i += MAX_CONCURRENT_REGIONS) {
    batches.push(regionsToProcess.slice(i, i + MAX_CONCURRENT_REGIONS));
  }
  
  for (const batch of batches) {
    console.log(`\n📦 Processing batch: ${batch.join(', ')}`);
    
    const batchPromises = batch.map(async (regionKey, index) => {
      // Stagger region starts to avoid overwhelming the system
      if (index > 0) {
        await sleep(REGION_DELAY_MS * index);
      }
      return processRegion(regionKey, runId);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      console.log(`⏳ Waiting ${REGION_DELAY_MS}ms before next batch...`);
      await sleep(REGION_DELAY_MS);
    }
  }
  
  return results;
}

// Sequential region processing for better reliability
async function processRegionsSequentially(runId, regionKeys = null) {
  const regionsToProcess = regionKeys || getRegionKeys();
  
  console.log(`\n🚀 Processing ${regionsToProcess.length} regions sequentially...`);
  console.log(`📋 Order: ${regionsToProcess.join(' → ')}`);
  
  const results = [];
  
  for (let i = 0; i < regionsToProcess.length; i++) {
    const regionKey = regionsToProcess[i];
    const region = REGIONS[regionKey];
    
    console.log(`\n🏙️  Processing ${region.name} (${i + 1}/${regionsToProcess.length})...`);
    console.log(`📍 Cities: ${region.cities.map(c => c.name).join(', ')}`);
    
    try {
      const result = await processRegion(regionKey, runId);
      results.push(result);
      
      console.log(`✅ ${region.name} completed: ${result.listings.length} listings`);
      
      // Small delay between regions to prevent overwhelming the system
      if (i < regionsToProcess.length - 1) {
        console.log(`⏳ Waiting 3 seconds before next region...`);
        await sleep(3000);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${region.name}:`, error.message);
      console.log(`⚠️  Continuing with next region...`);
      
      // Add empty result for failed region
      results.push({
        region: regionKey,
        listings: [],
        cities: region.cities.length,
        error: error.message
      });
    }
  }
  
  console.log(`\n✅ Sequential processing completed! Processed ${results.length} regions`);
  return results;
}

// Enhanced detection with regional filtering
async function detectJustListedAndSoldByRegion(regionKey = null) {
  console.log("\n🔍 Detecting just-listed and sold listings...");
  
  try {
    let currentQuery = supabase.from(CURRENT_LISTINGS_TABLE).select("*");
    let previousQuery = supabase.from(PREVIOUS_LISTINGS_TABLE).select("*");
    
    // Filter by region if specified
    if (regionKey) {
      const region = REGIONS[regionKey];
      currentQuery = currentQuery.eq('region', region.name);
      previousQuery = previousQuery.eq('region', region.name);
    }
    
    const { data: currentListings, error: currentError } = await currentQuery;
    if (currentError) throw currentError;

    const { data: previousListings, error: prevError } = await previousQuery;
    if (prevError) throw prevError;

    // Create sets for efficient comparison
    const currentZpidSet = new Set(currentListings.map(l => l.zpid));
    const previousZpidSet = new Set(previousListings.map(l => l.zpid));

    // Find just-listed and sold
    const justListed = currentListings.filter(listing => !previousZpidSet.has(listing.zpid));
    const soldListings = previousListings.filter(listing => !currentZpidSet.has(listing.zpid));

    console.log(`📊 Found ${justListed.length} just-listed and ${soldListings.length} sold listings`);

    // Store results
    if (justListed.length > 0) {
      await upsertListingsWithValidation(justListed, JUST_LISTED_TABLE);
      console.log(`✅ Stored ${justListed.length} just-listed listings`);
    }

    if (soldListings.length > 0) {
      await upsertListingsWithValidation(soldListings, SOLD_LISTINGS_TABLE);
      console.log(`✅ Stored ${soldListings.length} sold listings`);
    }

    return { justListed, soldListings };
  } catch (error) {
    console.error("❌ Error detecting listings:", error);
    throw error;
  }
}

// ----- Main -----
async function main(regionKeys = null, skipDetection = false) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log("🚀 Starting real-time listing detection system...");
  console.log("Proxy User:", process.env.SMARTPROXY_USER);
  console.log("Proxy Pass:", process.env.SMARTPROXY_PASS ? "****" : "Not Set");

  const runId = await startRun();
  let results = {
    success: false,
    error: null,
    totalListings: 0,
    justListed: 0,
    soldListings: 0,
    verificationResults: { verifiedSold: 0, movedBackToActive: 0, inconclusive: 0 },
    regionalResults: {},
    runDuration: '',
    timestamp,
    failedCities: [] // Track failed cities for email notifications
  };

  try {
    // Step 1: Process regions (concurrent or single region)
    console.log("\n📡 Scraping listings from regions...");
    let allListings = [];
    let totalListings = 0;
    
    if (regionKeys && regionKeys.length === 1) {
      // Single region processing
      const regionResult = await processRegion(regionKeys[0], runId);
      allListings = regionResult.listings;
      totalListings = allListings.length;
      results.regionalResults[regionKeys[0]] = { 
        listings: allListings.length, 
        cities: REGIONS[regionKeys[0]].cities.length 
      };
    } else {
      // Multiple regions or all regions
      const regionalResults = await processRegionsSequentially(runId, regionKeys);
      
      for (const { region, listings } of regionalResults) {
        allListings.push(...listings);
        totalListings += listings.length;
        results.regionalResults[region] = { 
          listings: listings.length, 
          cities: REGIONS[region].cities.length 
        };
      }
    }
    
    results.totalListings = totalListings;

    // Step 2: City-level data quality assessment and retry
    console.log("\n📊 Assessing data quality per city...");
    getDataQualityReport();
    
    // Retry failed cities for maximum accuracy
    const retryResults = await retryFailedCities(runId);
    if (retryResults.length > 0) {
      console.log(`\n✅ Retry recovered ${retryResults.length} additional listings`);
      allListings.push(...retryResults);
      totalListings = allListings.length;
    }
    
    // Step 3: Normalize and store in current_listings table FIRST
    console.log("\n💾 Storing current listings...");
    const mapped = allListings.map((it) =>
      mapItemToRow(it, it.__meta?.areaName, it.__meta?.page, it.__meta?.runId, it.__meta?.regionName)
    );
    // Validate listings before upserting
    const validatedMapped = mapped.filter(listing => {
      if (!validateListingData(listing)) {
        console.warn(`Skipping invalid listing: ${listing.zpid}`);
        return false;
      }
      return true;
    });

    await upsertListingsWithValidation(validatedMapped, CURRENT_LISTINGS_TABLE);

    // Step 4: Smart city-level detection (only for successful cities) - BEFORE table switching
    let allJustListed = [];
    let allSoldListings = [];

    if (skipDetection) {
      console.log("\n⏭️  Skipping detection (first-time run) - just populating database");
    } else {
      console.log("\n🔍 Running smart city-level detection...");
      
      // Diagnose table status first
      await diagnoseTableStatus();
      
      // Get successful cities only (cities that have data)
      const successfulCities = getSuccessfulCities();
      const failedCities = getCitiesNeedingRetry();
      
      console.log(`\n✅ Successful cities (${successfulCities.length}): ${successfulCities.join(', ')}`);
      if (failedCities.length > 0) {
        console.log(`❌ Failed cities (${failedCities.length}): ${failedCities.join(', ')}`);
        console.log(`⚠️  Skipping detection for failed cities to avoid data corruption`);
        console.log(`💡 Suggestion: Run 'npm run retry:failed "${failedCities.join(',')}"' to fix failed cities`);
      }
      
      // Only run detection on successful cities
      if (successfulCities.length > 0) {
        console.log(`\n📍 Detecting changes for ${successfulCities.length} successful cities: ${successfulCities.join(', ')}`);
        
        for (const cityName of successfulCities) {
          const { justListed, soldListings } = await detectJustListedAndSoldByCity(cityName);
          allJustListed.push(...justListed);
          allSoldListings.push(...soldListings);
        }
        
        console.log(`\n📈 CITY-LEVEL DETECTION RESULTS:`);
        console.log(`   Total just-listed: ${allJustListed.length}`);
        console.log(`   Total sold: ${allSoldListings.length}`);
        
        // Store city-level results
        if (allJustListed.length > 0) {
          console.log(`\n📦 Storing ${allJustListed.length} just-listed listings...`);
          await upsertListingsWithValidation(allJustListed, JUST_LISTED_TABLE);
          console.log(`✅ Stored ${allJustListed.length} just-listed listings`);
        }
        
        if (allSoldListings.length > 0) {
          console.log(`\n📦 Storing ${allSoldListings.length} sold listings...`);
          await upsertListingsWithValidation(allSoldListings, SOLD_LISTINGS_TABLE);
          console.log(`✅ Stored ${allSoldListings.length} sold listings`);
        }
      } else {
        console.log(`\n⚠️  No successful cities to run detection on`);
        console.log(`💡 All cities failed - consider checking coordinates or running retry script`);
      }
    }
    
    // Update results for compatibility
    const justListed = allJustListed;
    const soldListings = allSoldListings;
    results.justListed = justListed.length;
    results.soldListings = soldListings.length;

    // Step 7: Skip verification for now (can be re-enabled later)
    let verificationResults = { verifiedSold: 0, movedBackToActive: 0, inconclusive: 0 };
    if (soldListings.length > 0) {
      console.log(`⏭️  Skipping verification for ${soldListings.length} sold listings (disabled for now)`);
      // verificationResults = await verifySoldListings(soldListings);
    }
    results.verificationResults = verificationResults;

    // Step 6: Collect city-by-city data for email BEFORE table switching
    console.log("\n📊 Collecting city-by-city detection results for email...");
    const cityDetails = [];
    const successfulCities = getSuccessfulCities();
    
    for (const cityName of successfulCities) {
      const { justListed, soldListings } = await detectJustListedAndSoldByCity(cityName);
      const city = getAllCities().find(c => c.name === cityName);
      cityDetails.push({
        name: cityName,
        region: city?.region || 'unknown',
        justListed: justListed.length,
        sold: soldListings.length,
        total: justListed.length + soldListings.length
      });
    }
    
    // Add city details to results
    results.cityDetails = cityDetails;

    // Step 7: Switch tables AFTER detection to prepare for next run
    if (!skipDetection) {
      console.log("\n🔄 Switching tables AFTER detection to prepare for next run...");
      await switchTables();
      results.tableSwitchPerformed = true;
    }

    // Calculate duration
    const endTime = Date.now();
    results.runDuration = `${Math.round((endTime - startTime) / 1000)}s`;
    results.success = true;

    console.log("\n✅ Real-time listing detection completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Total listings scraped: ${totalListings}`);
    console.log(`   - Just-listed: ${justListed.length}`);
    console.log(`   - Sold (initial): ${soldListings.length}`);
    console.log(`   - Verification results:`);
    console.log(`     • Verified sold: ${verificationResults.verifiedSold}`);
    console.log(`     • Moved back to active: ${verificationResults.movedBackToActive}`);
    console.log(`     • Inconclusive: ${verificationResults.inconclusive}`);
    console.log(`   - Regional breakdown:`);
    Object.entries(results.regionalResults).forEach(([region, data]) => {
      console.log(`     • ${region}: ${data.listings} listings from ${data.cities} cities`);
    });
    
    // Smart handling summary
    const failedCities = getCitiesNeedingRetry();
    
    if (failedCities.length > 0) {
      console.log(`\n🛡️  SMART HANDLING SUMMARY:`);
      console.log(`   ✅ Processed ${successfulCities.length} successful cities`);
      console.log(`   ❌ Skipped ${failedCities.length} failed cities (no data corruption)`);
      console.log(`   💡 To fix failed cities: npm run retry:failed "${failedCities.join(',')}"`);
    }

  } catch (e) {
    console.error("❌ Run failed:", e);
    results.error = e.message;
    results.runDuration = `${Math.round((Date.now() - startTime) / 1000)}s`;
  } finally {
    await endRun(runId);

    // Add failed cities information to results for email notification
    results.failedCities = getCitiesNeedingRetry();

    // Send email notification
    console.log("\n📧 Sending email notification...");
    await sendScrapeNotification(results);
  }
}

// Export functions for use in other modules
export { 
  main, 
  processRegion, 
  processRegionsConcurrently, 
  detectJustListedAndSoldByRegion,
  mapItemToRow,
  upsertListingsWithValidation,
  validateListingData,
  fetchPageWithRetries,
  sleep,
  REGIONS,
  getAllCities,
  getCitiesForRegion,
  getRegionKeys
};

// Only run if called directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for region argument
  const regionArg = process.argv[2];
  const regionKeys = regionArg ? [regionArg] : null;

  main(regionKeys).catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
}