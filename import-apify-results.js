// import-apify-results.js - Fetch Apify Zillow scraper results and upsert to Supabase
import dotenv from 'dotenv';
dotenv.config();
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const DATASET_ID = process.argv[2] || '8fdvLBxAywXz1zkOh';

const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

const LISTINGS_TABLE = 'listings';
const UPSERT_BATCH_SIZE = 200;
const STATUS = {
  JUST_LISTED: 'just_listed',
  ACTIVE: 'active',
  PRICE_CHANGED: 'price_changed',
  SOLD: 'sold',
};

function mapApifyToRow(item) {
  const zpid = Number(item.zpid);
  if (!zpid || !Number.isFinite(zpid)) return null;

  const homeInfo = item.hdpData?.homeInfo || {};
  const validateNumeric = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  const lat = homeInfo.latitude ?? item.latLong?.latitude ?? null;
  const lng = homeInfo.longitude ?? item.latLong?.longitude ?? null;
  const city = homeInfo.city ?? item.addressCity ?? null;
  const state = homeInfo.state ?? item.addressState ?? null;
  const country = homeInfo.country === 'CAN' || state === 'ON' ? 'CAN' : 'USA';
  const currency = homeInfo.currency || (country === 'CAN' ? 'CAD' : 'USD');
  const price = homeInfo.price ?? item.unformattedPrice ?? null;

  // Build carousel photos from composable data
  let carouselPhotos = null;
  if (item.carouselPhotosComposable?.photoData) {
    const baseUrl = item.carouselPhotosComposable.baseUrl || 'https://photos.zillowstatic.com/fp/{photoKey}-p_e.jpg';
    carouselPhotos = item.carouselPhotosComposable.photoData.map(p =>
      baseUrl.replace('{photoKey}', p.photoKey)
    );
  }

  // Determine region from city
  const windsorCities = ['Windsor','LaSalle','Lasalle','Leamington','Chatham-Kent','Chatham Kent',
    'Lakeshore','Amherstburg','Tecumseh','Kingsville','Essex','Tilbury','McGregor','Belle River'];
  const region = windsorCities.some(c => c.toLowerCase() === (city||'').toLowerCase()) ? 'Windsor Area' : null;

  return {
    zpid,
    lastrunid: 'apify-import',
    lastcity: city,
    lastpage: null,
    city: city,
    region: region,
    country: country,
    currency: currency,
    last_seen_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    rawhomestatuscd: item.rawHomeStatusCd ?? homeInfo.homeStatus ?? null,
    marketingstatussimplifiedcd: item.marketingStatusSimplifiedCd ?? null,
    statustype: item.statusType ?? homeInfo.homeStatus ?? null,
    statustext: item.statusText ?? null,
    imgsrc: item.imgSrc ?? null,
    hasimage: item.hasImage ?? (item.imgSrc ? true : null),
    detailurl: item.detailUrl ?? `https://www.zillow.com/homedetails/${zpid}_zpid/`,
    countrycurrency: item.countryCurrency ?? currency,
    price: item.price ?? (price ? `$${price.toLocaleString()}` : null),
    unformattedprice: price,
    address: item.address ?? [item.addressStreet || homeInfo.streetAddress, city, state, item.addressZipcode || homeInfo.zipcode].filter(Boolean).join(', ') || null,
    addressstreet: item.addressStreet ?? homeInfo.streetAddress ?? null,
    addresszipcode: item.addressZipcode ?? homeInfo.zipcode ?? null,
    addresscity: city,
    addressstate: state,
    isundisclosedaddress: item.isUndisclosedAddress ?? false,
    beds: validateNumeric(homeInfo.bedrooms ?? item.beds),
    baths: validateNumeric(homeInfo.bathrooms ?? item.baths),
    area: validateNumeric(homeInfo.livingArea ?? item.area),
    latlong: JSON.stringify({ latitude: lat, longitude: lng }),
    hdpdata: item.hdpData ? JSON.stringify(item.hdpData) : null,
    carouselphotos: carouselPhotos ? JSON.stringify(carouselPhotos) : null,
    iszillowowned: item.isZillowOwned ?? false,
    issaved: false,
    isuserclaimingowner: false,
    isuserconfirmedclaim: false,
    shouldshowzestimateasprice: false,
    has3dmodel: item.has3DModel ?? false,
    isjustlisted: false,
    flexfieldtext: item.flexFieldText ?? null,
    contenttype: homeInfo.homeType ?? null,
    pgapt: item.pgapt ?? null,
    sgapt: item.sgapt ?? null,
    list: item.list ?? null,
    info1string: item.info1String ?? null,
    brokername: item.brokerName ?? null,
    hasvideo: item.hasVideo ?? false,
    lotareastring: homeInfo.lotAreaValue ? `${homeInfo.lotAreaValue} ${homeInfo.lotAreaUnit ?? 'sqft'}` : null,
    providerlistingid: null,
    lastseenat: new Date().toISOString(),
    carousel_photos_composable: item.carouselPhotosComposable ? JSON.stringify(item.carouselPhotosComposable) : null,
  };
}

async function main() {
  console.log(`📦 Fetching results from Apify dataset: ${DATASET_ID}`);

  // Fetch all items from the dataset
  let allItems = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}&format=json`;
    const resp = await fetch(url);
    const items = await resp.json();

    if (!items || items.length === 0) break;
    allItems = allItems.concat(items);
    console.log(`  Fetched ${allItems.length} items so far...`);

    if (items.length < limit) break;
    offset += limit;
  }

  console.log(`✅ Total items fetched: ${allItems.length}`);

  // Map to database rows
  const rows = allItems.map(mapApifyToRow).filter(Boolean);
  console.log(`📋 Mapped ${rows.length} valid listings`);

  // Deduplicate by zpid
  const dedupMap = new Map();
  rows.forEach(r => dedupMap.set(r.zpid, r));
  const dedupedRows = Array.from(dedupMap.values());
  console.log(`🔄 After dedup: ${dedupedRows.length} unique listings`);

  // Fetch existing listings
  const zpids = dedupedRows.map(r => r.zpid);
  console.log(`📊 Fetching existing listings from database...`);

  let existing = [];
  // Fetch in batches of 500 zpids
  for (let i = 0; i < zpids.length; i += 500) {
    const batch = zpids.slice(i, i + 500);
    const { data, error } = await supabase
      .from(LISTINGS_TABLE)
      .select('zpid, unformattedprice, status')
      .in('zpid', batch);
    if (error) {
      console.error('Error fetching existing:', error);
    } else {
      existing = existing.concat(data || []);
    }
  }

  const existingMap = new Map(existing.map(l => [l.zpid, l]));
  console.log(`  Found ${existingMap.size} existing listings`);

  // Process each listing - preserve first_seen_at for existing listings
  const stats = { new: 0, updated: 0, priceChanges: 0, errors: 0 };
  const toUpsert = dedupedRows.map(listing => {
    const ex = existingMap.get(listing.zpid);
    if (!ex) {
      // NEW listing - set first_seen_at and just_listed
      stats.new++;
      return { ...listing, status: STATUS.JUST_LISTED, first_seen_at: new Date().toISOString() };
    }
    // EXISTING listing - do NOT include first_seen_at so we don't overwrite it
    const { first_seen_at, ...listingWithoutFirstSeen } = listing;
    const oldPrice = ex.unformattedprice;
    const newPrice = listing.unformattedprice;
    if (oldPrice && newPrice && oldPrice !== newPrice) {
      stats.priceChanges++;
      return { ...listingWithoutFirstSeen, status: STATUS.PRICE_CHANGED, previous_price: oldPrice, price_change_date: new Date().toISOString() };
    }
    stats.updated++;
    return { ...listingWithoutFirstSeen, status: STATUS.ACTIVE };
  });

  // Batch upsert
  console.log(`⬆️  Upserting ${toUpsert.length} listings...`);
  const batches = Math.ceil(toUpsert.length / UPSERT_BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const start = i * UPSERT_BATCH_SIZE;
    const batch = toUpsert.slice(start, start + UPSERT_BATCH_SIZE);

    const { error } = await supabase
      .from(LISTINGS_TABLE)
      .upsert(batch, { onConflict: 'zpid', ignoreDuplicates: false });

    if (error) {
      console.error(`❌ Batch ${i + 1}/${batches} failed:`, error.message);
      stats.errors += batch.length;
    } else {
      console.log(`  ✅ Batch ${i + 1}/${batches} complete (${batch.length} rows)`);
    }
  }

  // Mark unseen listings as sold
  console.log('\n🔍 Checking for sold listings...');
  const scrapedZpids = new Set(dedupedRows.map(r => r.zpid));

  // Get all active (non-sold) listings for Windsor area cities
  const windsorCities = [...new Set(dedupedRows.map(r => r.city).filter(Boolean))];
  let activeListings = [];
  for (let i = 0; i < windsorCities.length; i += 5) {
    const cityBatch = windsorCities.slice(i, i + 5);
    const { data, error } = await supabase
      .from(LISTINGS_TABLE)
      .select('zpid')
      .in('city', cityBatch)
      .neq('status', 'sold');
    if (!error && data) activeListings = activeListings.concat(data);
  }

  const toMarkSold = activeListings.filter(l => !scrapedZpids.has(Number(l.zpid)));
  stats.sold = 0;

  if (toMarkSold.length > 0) {
    console.log(`  Found ${toMarkSold.length} listings to mark as sold`);
    for (let i = 0; i < toMarkSold.length; i += UPSERT_BATCH_SIZE) {
      const batch = toMarkSold.slice(i, i + UPSERT_BATCH_SIZE).map(r => r.zpid);
      const { error } = await supabase
        .from(LISTINGS_TABLE)
        .update({ status: STATUS.SOLD })
        .in('zpid', batch);
      if (error) {
        console.error(`  ❌ Sold batch error:`, error.message);
      } else {
        stats.sold += batch.length;
      }
    }
    console.log(`  ✅ Marked ${stats.sold} listings as sold`);
  } else {
    console.log('  No new sold listings detected');
  }

  // Print city breakdown
  const cityCounts = {};
  dedupedRows.forEach(r => {
    cityCounts[r.city] = (cityCounts[r.city] || 0) + 1;
  });

  console.log('\n==============================');
  console.log('📊 IMPORT COMPLETE');
  console.log(`  Total: ${dedupedRows.length} listings`);
  console.log(`  New: ${stats.new} | Updated: ${stats.updated} | Price Changes: ${stats.priceChanges} | Sold: ${stats.sold} | Errors: ${stats.errors}`);
  console.log('\n  By city:');
  Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`    ${city}: ${count}`);
  });
  console.log('==============================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
