// unified-scraper.js - Single-Table RapidAPI Scraper with Status Tracking
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
  console.error("❌ Missing Supabase credentials.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// RapidAPI Configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'fad289c8b7msh67ab38f37446aedp1132acjsnc18eaf48b653';
const RAPIDAPI_HOST = 'us-real-estate-data.p.rapidapi.com';

// Configuration
const LISTINGS_TABLE = "listings"; // Single unified table
const SCRAPE_LOGS_TABLE = "scrape_logs";
const STATUS_HISTORY_TABLE = "listing_status_history";

const UPSERT_BATCH_SIZE = 200;
const MAX_PAGES_PER_CITY = 20;
const PAGE_DELAY_MS = 1000;
const UPSERT_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Status enum
const STATUS = {
  JUST_LISTED: 'just_listed',
  ACTIVE: 'active',
  PRICE_CHANGED: 'price_changed',
  SOLD: 'sold',
  OFF_MARKET: 'off_market'
};

/**
 * Logger utility with timestamps
 */
class Logger {
  constructor(runId, city) {
    this.runId = runId;
    this.city = city;
    this.errors = [];
  }

  info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.city}] ℹ️  ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }

  success(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.city}] ✅ ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.city}] ❌ ${message}`);
    if (error) {
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    this.errors.push({ message, error: error?.message, timestamp });
  }

  warn(message) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${this.city}] ⚠️  ${message}`);
  }

  getErrors() {
    return this.errors;
  }
}

/**
 * Map RapidAPI response to unified schema
 */
function mapRapidAPIToRow(item, cityName, page, runId, regionName = null, country = 'USA', photoUrls = null, agentInfo = null) {
  const zpid = item?.zpid;

  if (!zpid) {
    return null;
  }

  const validateNumeric = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  const latObj = {
    latitude: item?.latitude ?? null,
    longitude: item?.longitude ?? null,
  };

  const currency = item?.currency || (country === 'CAN' ? 'CAD' : 'USD');

  return {
    zpid,
    lastrunid: runId,
    lastcity: cityName,
    lastpage: Number.isFinite(page) && page > 0 ? page : null,
    city: cityName,
    region: regionName,
    country: country,
    currency: currency,

    // Status fields (will be set by upsert logic)
    // status: determined later
    // first_seen_at: determined later
    last_seen_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),

    // Listing data
    rawhomestatuscd: item?.homeStatus ?? null,
    marketingstatussimplifiedcd: item?.homeStatus ?? null,
    statustype: item?.homeStatus ?? null,
    statustext: item?.homeStatusForHDP ?? null,
    imgsrc: item?.imgSrc ?? null,
    hasimage: item?.imgSrc ? true : null,
    detailurl: zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null,
    countrycurrency: currency,
    price: item?.price ? `$${item.price.toLocaleString()}` : null,
    unformattedprice: item?.price ?? item?.priceForHDP ?? null,
    address: item?.streetAddress ?? null,
    addressstreet: item?.streetAddress ?? null,
    addresszipcode: item?.zipcode ?? null,
    addresscity: item?.city ?? null,
    addressstate: item?.state ?? null,
    isundisclosedaddress: false,
    beds: validateNumeric(item?.bedrooms),
    baths: validateNumeric(item?.bathrooms),
    area: validateNumeric(item?.livingArea),
    latlong: JSON.stringify(latObj),
    hdpdata: agentInfo ? JSON.stringify(agentInfo) : null,
    carouselphotos: photoUrls && photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
    iszillowowned: item?.isZillowOwned ?? null,
    issaved: false,
    isuserclaimingowner: false,
    isuserconfirmedclaim: false,
    shouldshowzestimateasprice: false,
    has3dmodel: item?.is3dHome ?? null,
    isjustlisted: page <= 4,
    flexfieldtext: null,
    contenttype: item?.homeType ?? null,
    pgapt: item?.unit ?? null,
    sgapt: null,
    list: null,
    info1string: `${item?.bedrooms ?? 0} bd, ${item?.bathrooms ?? 0} ba`,
    brokername: agentInfo?.brokerageName || null,
    openhousedescription: item?.openHouse ?? null,
    buildername: null,
    hasvideo: false,
    ispropertyresultcdp: false,
    lotareastring: item?.lotAreaValue ? `${Math.floor(item.lotAreaValue)} ${item?.lotAreaUnit ?? 'sqft'}` : null,
    providerlistingid: agentInfo?.mlsId || null,
    streetviewmetadataurl: null,
    streetviewurl: null,
    lastseenat: new Date().toISOString(),
    openhousestartdate: item?.open_house_info?.open_house_showing?.[0]?.open_house_start
      ? new Date(item.open_house_info.open_house_showing[0].open_house_start).toISOString()
      : null,
    openhouseenddate: item?.open_house_info?.open_house_showing?.[0]?.open_house_end
      ? new Date(item.open_house_info.open_house_showing[0].open_house_end).toISOString()
      : null,
    availability_date: null,
    carousel_photos_composable: null,
  };
}

/**
 * Fetch listings from RapidAPI with error handling
 */
async function fetchRapidAPIListings(cityName, stateName, page, logger) {
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

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      listings: data.results || [],
      totalPages: data.totalPages || 1,
      totalResults: data.totalResultCount || 0,
      resultsPerPage: data.resultsPerPage || 0
    };

  } catch (error) {
    logger.error(`API fetch failed for page ${page}`, error);
    return {
      success: false,
      error: error.message,
      listings: []
    };
  }
}

/**
 * Fetch property details from RapidAPI /propertyV2 endpoint
 */
async function fetchPropertyDetails(zpid, logger) {
  const params = new URLSearchParams({
    zpid: zpid,
    output: 'json'
  });

  const url = `https://${RAPIDAPI_HOST}/propertyV2?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data
    };

  } catch (error) {
    logger.error(`Failed to fetch property details for zpid ${zpid}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract largest JPEG URLs from originalPhotos array
 */
function extractPhotoUrls(propertyData) {
  if (!propertyData || !propertyData.originalPhotos || !Array.isArray(propertyData.originalPhotos)) {
    return [];
  }

  const photoUrls = [];

  for (const photo of propertyData.originalPhotos) {
    if (photo?.mixedSources?.jpeg && Array.isArray(photo.mixedSources.jpeg)) {
      // Sort by width descending and get the largest
      const sortedJpegs = photo.mixedSources.jpeg.sort((a, b) => (b.width || 0) - (a.width || 0));

      if (sortedJpegs.length > 0 && sortedJpegs[0]?.url) {
        photoUrls.push(sortedJpegs[0].url);
      }
    }
  }

  return photoUrls;
}

/**
 * Extract agent information from propertyV2 response
 */
function extractAgentInfo(propertyData) {
  if (!propertyData) {
    return null;
  }

  const agentInfo = {
    brokerageName: propertyData.brokerageName || null,
    agentName: null,
    agentPhone: null,
    agentEmail: null,
    agentLicense: null,
    coAgentName: null,
    coAgentPhone: null,
    coAgentLicense: null,
    mlsId: null,
    mlsName: null,
    listingAgents: []
  };

  // Extract from attributionInfo
  if (propertyData.attributionInfo) {
    const attr = propertyData.attributionInfo;
    agentInfo.agentName = attr.agentName || null;
    agentInfo.agentPhone = attr.agentPhoneNumber || null;
    agentInfo.agentEmail = attr.agentEmail || null;
    agentInfo.agentLicense = attr.agentLicenseNumber || null;
    agentInfo.coAgentName = attr.coAgentName || null;
    agentInfo.coAgentPhone = attr.coAgentNumber || null;
    agentInfo.coAgentLicense = attr.coAgentLicenseNumber || null;
    agentInfo.mlsId = attr.mlsId || null;
    agentInfo.mlsName = attr.mlsName || null;

    // Extract all listing agents
    if (attr.listingAgents && Array.isArray(attr.listingAgents)) {
      agentInfo.listingAgents = attr.listingAgents
        .filter(a => a.memberFullName)
        .map(a => ({
          name: a.memberFullName,
          license: a.memberStateLicense,
          type: a.associatedAgentType
        }));
    }
  }

  return agentInfo;
}

/**
 * Smart upsert with status tracking
 */
async function smartUpsertListings(newListings, logger) {
  if (newListings.length === 0) {
    logger.warn('No listings to upsert');
    return {
      new: 0,
      updated: 0,
      priceChanges: 0,
      errors: 0
    };
  }

  const stats = {
    new: 0,
    updated: 0,
    priceChanges: 0,
    errors: 0
  };

  try {
    // Get existing listings
    const zpids = newListings.map(l => l.zpid);
    logger.info(`Fetching ${zpids.length} existing listings from database...`);

    const { data: existing, error: fetchError } = await supabase
      .from(LISTINGS_TABLE)
      .select('zpid, unformattedprice, status')
      .in('zpid', zpids);

    if (fetchError) {
      logger.error('Failed to fetch existing listings', fetchError);
      throw fetchError;
    }

    const existingMap = new Map(existing?.map(l => [l.zpid, l]) || []);
    logger.info(`Found ${existingMap.size} existing listings`);

    // Process each listing
    const toUpsert = newListings.map(listing => {
      const existing = existingMap.get(listing.zpid);

      if (!existing) {
        // NEW LISTING
        stats.new++;
        return {
          ...listing,
          status: STATUS.JUST_LISTED,
          first_seen_at: new Date().toISOString()
        };
      } else {
        // EXISTING LISTING
        const oldPrice = existing.unformattedprice;
        const newPrice = listing.unformattedprice;

        if (oldPrice && newPrice && oldPrice !== newPrice) {
          // PRICE CHANGED
          stats.priceChanges++;
          return {
            ...listing,
            status: STATUS.PRICE_CHANGED,
            previous_price: oldPrice,
            price_change_date: new Date().toISOString()
          };
        } else {
          // NO CHANGE - STILL ACTIVE
          stats.updated++;
          return {
            ...listing,
            status: STATUS.ACTIVE
          };
        }
      }
    });

    // Batch upsert
    logger.info(`Upserting ${toUpsert.length} listings in batches...`);
    const batches = Math.ceil(toUpsert.length / UPSERT_BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * UPSERT_BATCH_SIZE;
      const end = start + UPSERT_BATCH_SIZE;
      const batch = toUpsert.slice(start, end);

      let attempt = 0;
      let success = false;

      while (attempt < UPSERT_RETRIES && !success) {
        attempt++;
        try {
          const { error: upsertError } = await supabase
            .from(LISTINGS_TABLE)
            .upsert(batch, {
              onConflict: 'zpid',
              ignoreDuplicates: false
            });

          if (upsertError) throw upsertError;

          logger.success(`Batch ${i + 1}/${batches} complete (${batch.length} rows)`);
          success = true;

        } catch (err) {
          logger.error(`Batch ${i + 1} attempt ${attempt} failed`, err);
          if (attempt >= UPSERT_RETRIES) {
            stats.errors += batch.length;
            throw err;
          }
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }

    return stats;

  } catch (error) {
    logger.error('Smart upsert failed', error);
    throw error;
  }
}

/**
 * Mark listings as sold that weren't seen in this scrape
 */
async function markUnseenAsSold(cityName, runId, scrapeStartTime, logger) {
  try {
    logger.info(`Checking for sold listings in ${cityName}...`);

    const { data: unseen, error: fetchError } = await supabase
      .from(LISTINGS_TABLE)
      .select('zpid, status')
      .eq('lastcity', cityName)
      .lt('last_seen_at', scrapeStartTime)
      .in('status', [STATUS.ACTIVE, STATUS.JUST_LISTED, STATUS.PRICE_CHANGED]);

    if (fetchError) {
      logger.error('Failed to fetch unseen listings', fetchError);
      return 0;
    }

    if (!unseen || unseen.length === 0) {
      logger.info('No unseen listings to mark as sold');
      return 0;
    }

    logger.info(`Found ${unseen.length} listings to mark as sold`);

    const zpidsToMarkSold = unseen.map(l => l.zpid);

    const { error: updateError } = await supabase
      .from(LISTINGS_TABLE)
      .update({
        status: STATUS.SOLD,
        removed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      })
      .in('zpid', zpidsToMarkSold);

    if (updateError) {
      logger.error('Failed to mark listings as sold', updateError);
      throw updateError;
    }

    logger.success(`Marked ${unseen.length} listings as sold`);
    return unseen.length;

  } catch (error) {
    logger.error('Mark unseen as sold failed', error);
    return 0;
  }
}

/**
 * Log scrape run to database
 */
async function logScrapeRun(logData) {
  try {
    const { error } = await supabase
      .from(SCRAPE_LOGS_TABLE)
      .insert([logData]);

    if (error) {
      console.error('Failed to log scrape run:', error.message);
    }
  } catch (err) {
    console.error('Failed to log scrape run:', err.message);
  }
}

/**
 * Scrape a single city
 */
async function scrapeCity(cityConfig, regionName, runId) {
  const cityName = cityConfig.name;
  const stateName = cityConfig.state || 'CA';
  const country = cityConfig.country || (stateName.length === 2 && ['ON', 'BC', 'QC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL'].includes(stateName) ? 'CAN' : 'USA');

  const logger = new Logger(runId, cityName);
  const scrapeStartTime = new Date().toISOString();

  logger.info(`🏙️  Starting scrape for ${cityName}, ${stateName} (${country})`);
  logger.info(`Region: ${regionName} | Run ID: ${runId}`);

  let allListings = [];
  let totalResults = 0;
  let totalPages = 0;
  let pagesScraped = 0;
  const errors = [];

  try {
    // Fetch first page
    logger.info('Fetching page 1...');
    const firstPage = await fetchRapidAPIListings(cityName, stateName, 1, logger);

    if (!firstPage.success) {
      throw new Error(`Failed to fetch page 1: ${firstPage.error}`);
    }

    allListings = firstPage.listings;
    totalResults = firstPage.totalResults;
    totalPages = Math.min(firstPage.totalPages, MAX_PAGES_PER_CITY);
    pagesScraped = 1;

    logger.info(`Found ${totalResults} total listings across ${totalPages} pages`);

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));

      logger.info(`Fetching page ${page}/${totalPages}...`);
      const pageData = await fetchRapidAPIListings(cityName, stateName, page, logger);

      if (pageData.success) {
        allListings = allListings.concat(pageData.listings);
        pagesScraped++;
        logger.info(`Page ${page} complete: ${pageData.listings.length} listings`);
      } else {
        logger.error(`Page ${page} failed: ${pageData.error}`);
        errors.push({ page, error: pageData.error });
      }
    }

    logger.success(`Scraped ${allListings.length} listings from ${pagesScraped} pages`);

    // Check which listings already have photos and agent data in the database
    logger.info('Checking database for existing photos/agent data...');
    const allZpids = allListings.map(l => l.zpid).filter(z => z);

    const { data: existingData, error: existingError } = await supabase
      .from(LISTINGS_TABLE)
      .select('zpid, carouselphotos, hdpdata')
      .in('zpid', allZpids)
      .not('carouselphotos', 'is', null)
      .not('hdpdata', 'is', null);

    if (existingError) {
      logger.error('Failed to check existing data', existingError);
    }

    // Create a Set of zpids that already have complete data
    const zpidsWithData = new Set((existingData || []).map(item => item.zpid));
    const needsFetching = allListings.filter(l => l.zpid && !zpidsWithData.has(l.zpid));
    const alreadyHasData = allListings.filter(l => l.zpid && zpidsWithData.has(l.zpid));

    logger.info(`Found ${zpidsWithData.size} listings with existing data (will skip)`);
    logger.info(`Need to fetch data for ${needsFetching.length} listings`);

    // Fetch photos and agent info only for listings that need it
    logger.info('Fetching photo carousels and agent info for new listings...');
    const listingsWithDetails = [];
    let detailsFetchedCount = 0;
    let detailsFailedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < allListings.length; i++) {
      const item = allListings[i];
      const zpid = item?.zpid;

      if (!zpid) {
        listingsWithDetails.push({ item, photoUrls: [], agentInfo: null });
        continue;
      }

      // Skip if listing already has photos and agent data
      if (zpidsWithData.has(zpid)) {
        listingsWithDetails.push({ item, photoUrls: null, agentInfo: null, skipFetch: true });
        skippedCount++;
        continue;
      }

      // Fetch property details with 500ms delay (2 requests/second rate limit)
      if (detailsFetchedCount > 0) {
        await new Promise(r => setTimeout(r, 500));
      }

      const propertyDetails = await fetchPropertyDetails(zpid, logger);

      if (propertyDetails.success && propertyDetails.data) {
        const photoUrls = extractPhotoUrls(propertyDetails.data);
        const agentInfo = extractAgentInfo(propertyDetails.data);
        listingsWithDetails.push({ item, photoUrls, agentInfo });
        detailsFetchedCount++;

        if (detailsFetchedCount % 10 === 0) {
          logger.info(`Fetched details for ${detailsFetchedCount}/${needsFetching.length} new listings...`);
        }
      } else {
        listingsWithDetails.push({ item, photoUrls: [], agentInfo: null });
        detailsFailedCount++;
      }
    }

    logger.success(`Details fetch complete: ${detailsFetchedCount} fetched, ${skippedCount} skipped, ${detailsFailedCount} failed`);
    logger.success(`💰 Saved ${skippedCount} API calls!`);

    // Map to database schema (only listings that need updating)
    logger.info('Mapping listings to database schema...');
    const mappedListings = listingsWithDetails
      .filter(listing => !listing.skipFetch) // Don't update listings we skipped
      .map((listing, idx) =>
        mapRapidAPIToRow(
          listing.item,
          cityName,
          Math.floor(idx / 41) + 1,
          runId,
          regionName,
          country,
          listing.photoUrls,
          listing.agentInfo
        )
      )
      .filter(l => l !== null);

    logger.info(`Mapped ${mappedListings.length} valid listings (${skippedCount} skipped to preserve existing data)`);

    // Smart upsert with status tracking
    logger.info('Upserting to database...');
    const upsertStats = await smartUpsertListings(mappedListings, logger);

    logger.success('Upsert complete', upsertStats);

    // Mark unseen listings as sold
    logger.info('Checking for sold listings...');
    const markedSold = await markUnseenAsSold(cityName, runId, scrapeStartTime, logger);

    // Log scrape run
    const scrapeEndTime = new Date().toISOString();
    const duration = Math.round((new Date(scrapeEndTime) - new Date(scrapeStartTime)) / 1000);

    await logScrapeRun({
      run_id: runId,
      region: regionName,
      city: cityName,
      country: country,
      started_at: scrapeStartTime,
      completed_at: scrapeEndTime,
      status: 'completed',
      total_scraped: allListings.length,
      new_listings: upsertStats.new,
      updated_listings: upsertStats.updated,
      price_changes: upsertStats.priceChanges,
      marked_sold: markedSold,
      pages_scraped: pagesScraped,
      errors_count: errors.length,
      error_details: errors.length > 0 ? JSON.stringify(errors) : null,
      duration_seconds: duration
    });

    logger.success(`✅ ${cityName} complete in ${duration}s`);
    logger.info(`Summary: ${upsertStats.new} new, ${upsertStats.updated} updated, ${upsertStats.priceChanges} price changes, ${markedSold} sold`);

    return {
      success: true,
      city: cityName,
      stats: {
        ...upsertStats,
        markedSold,
        totalScraped: allListings.length,
        pagesScraped,
        duration
      }
    };

  } catch (error) {
    logger.error(`Fatal error scraping ${cityName}`, error);

    // Log failed scrape
    await logScrapeRun({
      run_id: runId,
      region: regionName,
      city: cityName,
      country: country,
      started_at: scrapeStartTime,
      completed_at: new Date().toISOString(),
      status: 'failed',
      errors_count: 1,
      error_details: JSON.stringify({ message: error.message, stack: error.stack })
    });

    return {
      success: false,
      city: cityName,
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

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🌎 SCRAPE START: ${region.name}`);
  console.log(`   Run ID: ${runId}`);
  console.log(`   Cities: ${region.cities.length}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(70)}\n`);

  const startTime = Date.now();
  const results = [];

  for (const cityConfig of region.cities) {
    const result = await scrapeCity(cityConfig, region.name, runId);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const totalNew = successful.reduce((sum, r) => sum + (r.stats?.new || 0), 0);
  const totalUpdated = successful.reduce((sum, r) => sum + (r.stats?.updated || 0), 0);
  const totalPriceChanges = successful.reduce((sum, r) => sum + (r.stats?.priceChanges || 0), 0);
  const totalSold = successful.reduce((sum, r) => sum + (r.stats?.markedSold || 0), 0);
  const totalScraped = successful.reduce((sum, r) => sum + (r.stats?.totalScraped || 0), 0);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ SCRAPE COMPLETE: ${region.name}`);
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Cities: ${successful.length} successful, ${failed.length} failed`);
  console.log(`   Listings: ${totalScraped} scraped`);
  console.log(`   New: ${totalNew} | Updated: ${totalUpdated} | Price Changes: ${totalPriceChanges} | Sold: ${totalSold}`);
  console.log(`${'='.repeat(70)}\n`);

  // Send email notification
  try {
    await sendScrapeNotification({
      region: region.name,
      citiesScraped: successful.length,
      totalListings: totalScraped,
      newListings: totalNew,
      priceChanges: totalPriceChanges,
      soldListings: totalSold,
      duration: duration,
      runId: runId,
      results: results
    });
  } catch (emailError) {
    console.error('Failed to send email:', emailError.message);
  }

  return results;
}

/**
 * Scrape all regions
 */
async function scrapeAllRegions() {
  const regionKeys = getRegionKeys();
  console.log(`\n🌍 Scraping all ${regionKeys.length} regions...\n`);

  for (const regionKey of regionKeys) {
    await scrapeRegion(regionKey);
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
  const runId = uuidv4();
  const [cityName, stateName = 'CA'] = args[1].split(',').map(s => s.trim());
  scrapeCity({ name: cityName, state: stateName }, 'Test', runId).catch(console.error);
} else {
  console.log(`
Usage:
  node unified-scraper.js city "San Francisco, CA"   - Test single city
  node unified-scraper.js region bay-area             - Scrape one region
  node unified-scraper.js all                         - Scrape all regions
  `);
}
