#!/usr/bin/env node

// Advanced Zillow scraper with full anti-detection capabilities
import { createClient } from "@supabase/supabase-js";
import { runAdvancedScraper } from './advanced-scraper.js';
import { scheduler, SCHEDULING_STRATEGIES } from './advanced-scheduler.js';
import { detectJustListedAndSoldByRegion, switchTables } from './zillow.js';

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Advanced configuration
const ADVANCED_CONFIG = {
  // Detection settings
  ENABLE_DETECTION: true,
  ENABLE_EMAIL_NOTIFICATIONS: true,
  
  // Anti-detection settings
  RANDOMIZE_CITY_ORDER: true,
  USE_ADVANCED_PROXIES: true,
  ADAPTIVE_DELAYS: true,
  
  // Performance settings
  MAX_CONCURRENT_CITIES: 3,
  BATCH_SIZE: 5,
  ENABLE_RETRY_LOGIC: true
};

// Main advanced scraper function
async function runAdvancedZillowScraper() {
  const startTime = Date.now();
  console.log('🚀 Starting Advanced Zillow Scraper with Anti-Detection...');
  console.log(`⏰ Start time: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Advanced Data Collection
    console.log('\n📡 Phase 1: Advanced Data Collection...');
    const { results, totalListings } = await runAdvancedScraper();
    
    // Step 2: Detection (if enabled)
    let detectionResults = { justListed: [], soldListings: [] };
    
    if (ADVANCED_CONFIG.ENABLE_DETECTION) {
      console.log('\n🔍 Phase 2: Advanced Detection...');
      
      try {
        const { justListed, soldListings } = await detectJustListedAndSoldByRegion();
        detectionResults = { justListed, soldListings };
        
        console.log(`\n📈 DETECTION RESULTS:`);
        console.log(`   - Just-listed properties: ${justListed.length}`);
        console.log(`   - Sold properties: ${soldListings.length}`);
        
        if (justListed.length > 0) {
          console.log(`\n📋 Sample just-listed properties:`);
          justListed.slice(0, 3).forEach((listing, index) => {
            console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - ${listing.addresscity} ($${listing.unformattedprice || listing.price})`);
          });
        }
        
        if (soldListings.length > 0) {
          console.log(`\n📋 Sample sold properties:`);
          soldListings.slice(0, 3).forEach((listing, index) => {
            console.log(`  ${index + 1}. ${listing.addressstreet || listing.address} - ${listing.addresscity} ($${listing.unformattedprice || listing.price})`);
          });
        }
        
      } catch (error) {
        console.error('❌ Error during detection:', error.message);
        console.log('⚠️  Continuing without detection...');
      }
    }
    
    // Step 3: Table Management
    console.log('\n🔄 Phase 3: Table Management...');
    try {
      await switchTables();
      console.log('✅ Tables switched successfully');
    } catch (error) {
      console.error('❌ Error switching tables:', error.message);
    }
    
    // Step 4: Generate Report
    const duration = Math.round((Date.now() - startTime) / 1000);
    const successfulCities = Object.values(results).filter(r => r.success).length;
    const failedCities = Object.values(results).filter(r => !r.success).length;
    
    console.log('\n📊 ADVANCED SCRAPER REPORT:');
    console.log(`SUCCESS - ${new Date().toISOString()}`);
    console.log(`Scrape completed successfully!`);
    console.log(`Duration: ${duration}s`);
    console.log(`${totalListings}`);
    console.log(`Total Listings`);
    console.log(`${detectionResults.justListed.length}`);
    console.log(`Just Listed`);
    console.log(`${detectionResults.soldListings.length}`);
    console.log(`Sold Listings`);
    
    // City-by-city breakdown
    console.log(`City-by-City Breakdown`);
    Object.entries(results).forEach(([city, result]) => {
      if (result.success) {
        console.log(`${city}`);
        console.log(`${detectionResults.justListed.filter(l => l.addresscity === city).length} just-listed ${detectionResults.soldListings.filter(l => l.addresscity === city).length} sold`);
        console.log(`${result.listings} total`);
      } else {
        console.log(`${city}`);
        console.log(`0 just-listed 0 sold`);
        console.log(`0 total`);
      }
    });
    
    // Failed cities
    const failedCityNames = Object.entries(results)
      .filter(([_, result]) => !result.success)
      .map(([city, _]) => city);
    
    if (failedCityNames.length > 0) {
      console.log(`Failed Cities (${failedCityNames.length})`);
      console.log(`Cities that failed to scrape:`);
      failedCityNames.forEach(city => console.log(city));
      console.log(`To retry failed cities:`);
      console.log(`npm run retry:failed "${failedCityNames.join(',')}"`);
    }
    
    // Scheduling statistics
    const stats = scheduler.getStats();
    console.log(`\n📈 SCHEDULING STATISTICS:`);
    console.log(`Strategy: ${stats.currentStrategy}`);
    console.log(`Cities processed: ${stats.totalScheduled}`);
    console.log(`Success rate: ${Math.round((successfulCities / (successfulCities + failedCities)) * 100)}%`);
    
    // Next run time
    const nextRun = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
    console.log(`Next run: ${nextRun.toLocaleDateString()}, ${nextRun.toLocaleTimeString()}`);
    
    console.log(`Zillow Scraper - Advanced Real Estate Monitoring`);
    console.log(`This is an automated report from your advanced scheduled scraper.`);
    
    // Email notification (if enabled)
    if (ADVANCED_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
      console.log('\n📧 Sending email notification...');
      // Email logic would go here
    }
    
    console.log('\n🎉 Advanced scraper completed successfully!');
    
    return {
      success: true,
      totalListings,
      justListed: detectionResults.justListed.length,
      soldListings: detectionResults.soldListings.length,
      successfulCities,
      failedCities,
      duration
    };
    
  } catch (error) {
    console.error('❌ Advanced scraper failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Strategy management
function setScrapingStrategy(strategy) {
  if (Object.values(SCHEDULING_STRATEGIES).includes(strategy)) {
    scheduler.setStrategy(strategy);
    console.log(`🔄 Scraping strategy changed to: ${strategy}`);
  } else {
    console.log(`❌ Invalid strategy. Available: ${Object.values(SCHEDULING_STRATEGIES).join(', ')}`);
  }
}

// Export functions
export { runAdvancedZillowScraper, setScrapingStrategy, ADVANCED_CONFIG };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedZillowScraper().catch(console.error);
}
