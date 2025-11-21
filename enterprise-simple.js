#!/usr/bin/env node

// Simplified Enterprise System - No Redis Required
import { getAllCities } from './config/regions.js';
import { processRegionsConcurrently, detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { sendScrapeNotification } from './emailService.js';

// Enterprise configuration
const ENTERPRISE_CONFIG = {
  ENABLE_EMAIL_NOTIFICATIONS: true,
  // First run: skip detection (no previous data to compare against)
  // Subsequent runs: enable detection (compare current vs previous)
  ENABLE_DETECTION: process.env.FIRST_RUN !== 'true',
  ENABLE_MONITORING: true,
  MAX_CONCURRENT_REGIONS: 2, // Process 2 regions at a time
  REGION_DELAY_MS: 5000, // 5 second delay between regions
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  RETRY_FAILED_CITIES: true,
  MAX_RETRIES: 3,
  IS_FIRST_RUN: process.env.FIRST_RUN === 'true'
};

class SimpleEnterpriseOrchestrator {
  constructor() {
    this.isRunning = false;
    this.startTime = null;
    this.results = {};
    this.detectionResults = { justListed: [], soldListings: [] };
    this.metrics = {
      totalListings: 0,
      successfulCities: 0,
      failedCities: 0,
      totalDuration: 0,
      regionsProcessed: 0,
      retriesAttempted: 0
    };
  }

  // Main orchestration function
  async runEnterpriseScrape() {
    const runType = ENTERPRISE_CONFIG.IS_FIRST_RUN ? 'FIRST RUN (No Detection)' : 'REGULAR RUN (With Detection)';
    console.log('🚀 Starting Simplified Enterprise Zillow Scraper...');
    console.log(`📋 Run Type: ${runType}`);
    console.log('=' .repeat(60));
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    try {
      // Phase 1: Health check
      await this.performHealthCheck();

      // Phase 2: Get all cities and regions
      const cities = getAllCities();
      const regions = this.groupCitiesByRegion(cities);
      
      console.log(`📍 Processing ${cities.length} cities across ${regions.length} regions...`);
      console.log(`🏙️ Regions: ${regions.map(r => r.name).join(', ')}`);

      // Phase 3: Process regions with enterprise features (scrape new listings FIRST)
      await this.processRegionsWithEnterpriseFeatures(regions);

      // Phase 4: Run detection if enabled (compare NEW current vs OLD previous)
      // This compares the freshly scraped data (current) against the previous run's data (previous)
      if (ENTERPRISE_CONFIG.ENABLE_DETECTION) {
        console.log('🔍 Running detection (comparing NEW current vs OLD previous listings)...');
        await this.runEnterpriseDetection();
      } else {
        console.log('⏭️  Skipping detection (first run - no previous data to compare)');
        this.detectionResults = { justListed: [], soldListings: [] };
      }

      // Phase 5: Switch tables AFTER detection (prepare for NEXT run)
      // This copies current → previous so the NEXT run can compare against today's data
      // IMPORTANT: Only switch California regions to preserve Windsor/Toronto data!
      const californiaRegions = ['Bay Area', 'Los Angeles Area', 'San Diego Area'];

      if (!ENTERPRISE_CONFIG.IS_FIRST_RUN) {
        console.log('🔄 Switching tables AFTER detection (preparing for NEXT run)...');
        await this.switchTablesForNextRun(californiaRegions);
      } else {
        console.log('🔄 Switching tables (first run - preparing for NEXT run)...');
        await this.switchTablesForNextRun(californiaRegions);
      }

      // Phase 6: Send notifications
      if (ENTERPRISE_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
        await this.sendEnterpriseNotification();
      }

      // Phase 7: Generate final report
      await this.generateFinalReport();

      console.log('✅ Simplified Enterprise scrape completed successfully!');
      if (ENTERPRISE_CONFIG.IS_FIRST_RUN) {
        console.log('📝 Next run will enable detection and table switching');
      }
      
    } catch (error) {
      console.error('❌ Enterprise scrape failed:', error);
      await this.handleError(error);
    } finally {
      this.isRunning = false;
    }
  }

  // Group cities by region
  groupCitiesByRegion(cities) {
    const regionMap = new Map();
    
    cities.forEach(city => {
      const regionName = city.regionName;
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, {
          name: regionName,
          cities: []
        });
      }
      regionMap.get(regionName).cities.push(city);
    });
    
    return Array.from(regionMap.values());
  }

  // Perform health check
  async performHealthCheck() {
    console.log('🔍 Performing enterprise health check...');
    
    try {
      // Test database connection
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        'https://idbyrtwdeeruiutoukct.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko'
      );
      
      const { error } = await supabase.from('current_listings').select('count', { count: 'exact', head: true });
      if (error) throw new Error(`Database connection failed: ${error.message}`);
      
      // Test proxy system
      const { getSmartProxyAgent } = await import('./proxies.js');
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch('https://httpbin.org/ip', {
        agent: getSmartProxyAgent(),
        timeout: 10000
      });
      
      if (!response.ok) throw new Error('Proxy system not responding');
      
      console.log('✅ All health checks passed');
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      throw error;
    }
  }

  // Process regions with enterprise features
  async processRegionsWithEnterpriseFeatures(regions) {
    console.log('🏗️ Processing regions with enterprise features...');

    const regionKeys = regions.map(r => r.name);
    const results = [];
    const allListings = []; // Collect all listings for storage

    // Process regions in batches for better resource management
    for (let i = 0; i < regions.length; i += ENTERPRISE_CONFIG.MAX_CONCURRENT_REGIONS) {
      const batch = regions.slice(i, i + ENTERPRISE_CONFIG.MAX_CONCURRENT_REGIONS);

      console.log(`\n📊 Processing batch ${Math.floor(i / ENTERPRISE_CONFIG.MAX_CONCURRENT_REGIONS) + 1}: ${batch.map(r => r.name).join(', ')}`);

      // Process batch concurrently
      const batchPromises = batch.map(async (region) => {
        try {
          const regionKey = this.getRegionKey(region.name);
          console.log(`🏙️ Processing ${region.name} (${region.cities.length} cities)...`);

          const result = await processRegionsConcurrently([regionKey]);
          this.metrics.regionsProcessed++;

          if (result && result.length > 0) {
            const regionResult = result[0];
            this.metrics.totalListings += regionResult.listings?.length || 0;
            this.metrics.successfulCities += regionResult.cities || 0;

            console.log(`✅ ${region.name}: ${regionResult.listings?.length || 0} listings processed`);
            return { success: true, region: region.name, ...regionResult };
          } else {
            console.log(`❌ ${region.name}: No results returned`);
            return { success: false, region: region.name, error: 'No results returned' };
          }

        } catch (error) {
          console.error(`❌ ${region.name}: Error processing region:`, error.message);
          this.metrics.failedCities++;
          return { success: false, region: region.name, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      const fulfilledResults = batchResults
        .map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason });

      results.push(...fulfilledResults);

      // Collect listings from successful regions
      fulfilledResults.forEach(result => {
        if (result.success && result.listings) {
          allListings.push(...result.listings);
        }
      });

      // Delay between batches with randomization
      if (i + ENTERPRISE_CONFIG.MAX_CONCURRENT_REGIONS < regions.length) {
        const randomDelay = ENTERPRISE_CONFIG.REGION_DELAY_MS + Math.floor(Math.random() * 5000); // 5-10 seconds
        console.log(`⏳ Waiting ${randomDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
    }

    this.results = results;
    console.log(`✅ All regions processed: ${results.filter(r => r.success).length}/${results.length} successful`);

    // Retry failed cities if enabled
    if (ENTERPRISE_CONFIG.RETRY_FAILED_CITIES) {
      const failedResults = results.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.log(`🔄 Retrying ${failedResults.length} failed regions...`);
        await this.retryFailedRegions(failedResults);
      }
    }

    // 🔥 CRITICAL: Store all listings in database (THIS WAS MISSING!)
    if (allListings.length > 0) {
      console.log(`\n💾 Storing ${allListings.length} listings in database...`);

      const { mapItemToRow, upsertListingsWithValidation } = await import('./zillow.js');

      // Map listings to database format
      const mapped = allListings.map((it) =>
        mapItemToRow(it, it.__meta?.areaName, it.__meta?.page, it.__meta?.runId, it.__meta?.regionName)
      ).filter(listing => listing !== null); // Remove null entries

      console.log(`📊 Mapped ${allListings.length} listings to ${mapped.length} valid records`);

      // Store in current_listings table
      await upsertListingsWithValidation(mapped, 'current_listings');
      console.log(`✅ Successfully stored ${mapped.length} listings in current_listings table`);
    } else {
      console.log(`⚠️  No listings to store`);
    }
  }

  // Retry failed regions
  async retryFailedRegions(failedResults) {
    console.log('🔄 Retrying failed regions with enhanced anti-detection...');
    
    for (const failedResult of failedResults) {
      try {
        console.log(`🔄 Retrying ${failedResult.region}...`);
        
        // Wait longer before retry
        await new Promise(resolve => setTimeout(resolve, 10000 + Math.floor(Math.random() * 10000))); // 10-20 seconds
        
        const regionKey = this.getRegionKey(failedResult.region);
        const result = await processRegionsConcurrently([regionKey]);
        
        if (result && result.length > 0) {
          const regionResult = result[0];
          this.metrics.totalListings += regionResult.listings?.length || 0;
          this.metrics.successfulCities += regionResult.cities || 0;
          this.metrics.retriesAttempted++;
          
          console.log(`✅ ${failedResult.region}: Retry successful - ${regionResult.listings?.length || 0} listings`);
        } else {
          console.log(`❌ ${failedResult.region}: Retry failed`);
        }
        
      } catch (error) {
        console.error(`❌ ${failedResult.region}: Retry error:`, error.message);
      }
    }
  }

  // Get region key from region name
  getRegionKey(regionName) {
    const keyMap = {
      'Bay Area': 'bay-area',
      'Los Angeles Area': 'los-angeles-area',
      'San Diego Area': 'san-diego-area',
      'Windsor Area': 'windsor-area',
      'Greater Toronto Area': 'gta-area',
      'Milwaukee Area': 'milwaukee-area',
      'GTA Extended': 'gta-extended'
    };
    
    return keyMap[regionName] || regionName.toLowerCase().replace(/\s+/g, '-');
  }

  // Run enterprise detection with city-by-city processing
  async runEnterpriseDetection() {
    console.log('🔍 Running enterprise detection...');

    try {
      // First, check table status for debugging
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        'https://idbyrtwdeeruiutoukct.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko'
      );

      const { count: currentCount } = await supabase
        .from('current_listings')
        .select('*', { count: 'exact', head: true });

      const { count: previousCount } = await supabase
        .from('previous_listings')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Table status before detection:`);
      console.log(`   - current_listings: ${currentCount || 0} listings`);
      console.log(`   - previous_listings: ${previousCount || 0} listings`);

      if (previousCount === 0) {
        console.warn(`⚠️  WARNING: previous_listings is empty! Detection may not work correctly.`);
        console.warn(`   This might be because tables weren't switched properly.`);
      }

      // City-level detection (like Canadian scraper for detailed breakdown)
      console.log('\n📊 Collecting city-by-city detection results for email...');

      const { getAllCities } = await import('./config/regions.js');
      const cities = getAllCities();

      let allJustListed = [];
      let allSoldListings = [];
      this.cityDetails = [];  // Store city details for email

      // Process each city individually
      for (const city of cities) {
        try {
          console.log(`🔍 Detecting changes for ${city.name}...`);

          // Get city-specific data
          const { data: currentCityListings } = await supabase
            .from('current_listings')
            .select('*')
            .eq('city', city.name);

          const { data: previousCityListings } = await supabase
            .from('previous_listings')
            .select('*')
            .eq('city', city.name);

          console.log(`📊 ${city.name}: Current=${currentCityListings?.length || 0}, Previous=${previousCityListings?.length || 0}`);

          // Detect just-listed and sold
          const currentZpids = new Set((currentCityListings || []).map(l => l.zpid));
          const previousZpids = new Set((previousCityListings || []).map(l => l.zpid));

          const justListed = (currentCityListings || []).filter(l => !previousZpids.has(l.zpid));
          const sold = (previousCityListings || []).filter(l => !currentZpids.has(l.zpid));

          console.log(`📊 ${city.name}: ${justListed.length} just-listed, ${sold.length} sold`);

          if (sold.length > 0) {
            console.log(`📋 Sample sold listings for ${city.name}:`);
            sold.slice(0, 3).forEach((listing, index) => {
              console.log(`  ${index + 1}. ZPID: ${listing.zpid} - ${listing.addressstreet || listing.address} - ${listing.addresscity}`);
            });
          }

          // Store results
          allJustListed.push(...justListed);
          allSoldListings.push(...sold);

          // Track city details for email
          this.cityDetails.push({
            name: city.name,
            region: city.regionName,
            justListed: justListed.length,
            sold: sold.length,
            total: (currentCityListings || []).length
          });

        } catch (error) {
          console.error(`❌ Error detecting changes for ${city.name}:`, error.message);
        }
      }

      this.detectionResults = { justListed: allJustListed, soldListings: allSoldListings };

      console.log(`\n📈 CITY-LEVEL DETECTION RESULTS:`);
      console.log(`   Total just-listed: ${allJustListed.length}`);
      console.log(`   Total sold: ${allSoldListings.length}`);

    } catch (error) {
      console.error('❌ Detection failed:', error.message);
      console.error('   Stack:', error.stack);
      this.detectionResults = { justListed: [], soldListings: [] };
      this.cityDetails = [];
    }
  }

  // Switch tables for next run (region-aware)
  async switchTablesForNextRun(regionFilter = null) {
    console.log('🔄 Switching tables for next run...');

    try {
      await switchTables(regionFilter);
      console.log('✅ Tables switched successfully');
    } catch (error) {
      console.error('❌ Error switching tables:', error.message);
      throw error;
    }
  }

  // Send enterprise notification
  async sendEnterpriseNotification() {
    console.log('📧 Sending enterprise notification...');
    
    try {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.metrics.totalDuration = duration;
      
      const emailData = {
        success: true,
        totalListings: this.metrics.totalListings,
        justListed: this.detectionResults.justListed.length,
        soldListings: this.detectionResults.soldListings.length,
        runDuration: `${duration}s`,
        timestamp: new Date().toISOString(),
        cityDetails: this.generateCityDetails(),
        failedCities: this.results.filter(r => !r.success).map(r => r.region),
        enterpriseMetrics: {
          regionsProcessed: this.metrics.regionsProcessed,
          successfulCities: this.metrics.successfulCities,
          failedCities: this.metrics.failedCities,
          retriesAttempted: this.metrics.retriesAttempted,
          successRate: this.metrics.successfulCities > 0 ? 
            ((this.metrics.successfulCities / (this.metrics.successfulCities + this.metrics.failedCities)) * 100).toFixed(2) : 0
        }
      };

      await sendScrapeNotification(emailData);
      console.log('✅ Enterprise notification sent');
      
    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
    }
  }

  // Generate city details for email
  generateCityDetails() {
    console.log(`\n📊 Generating city details for email...`);
    console.log(`   Detection results: ${this.detectionResults.justListed.length} just-listed, ${this.detectionResults.soldListings.length} sold`);

    // Use the city details that were already collected during detection
    const cityDetails = this.cityDetails || [];

    console.log(`   Generated details for ${cityDetails.length} cities`);

    // Log cities with activity
    cityDetails.forEach(city => {
      if (city.justListed > 0 || city.sold > 0) {
        console.log(`   ${city.name}: ${city.justListed} just-listed, ${city.sold} sold`);
      }
    });
    
    // Sort by region, then by city name
    cityDetails.sort((a, b) => {
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region);
      }
      return a.name.localeCompare(b.name);
    });
    
    console.log(`   Generated details for ${cityDetails.length} cities`);
    
    return cityDetails;
  }

  // Generate final report
  async generateFinalReport() {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SIMPLIFIED ENTERPRISE SCRAPE FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`📋 Processing Stats:`);
    console.log(`   - Regions Processed: ${this.metrics.regionsProcessed}`);
    console.log(`   - Successful Cities: ${this.metrics.successfulCities}`);
    console.log(`   - Failed Cities: ${this.metrics.failedCities}`);
    console.log(`   - Success Rate: ${this.metrics.successfulCities > 0 ? 
      ((this.metrics.successfulCities / (this.metrics.successfulCities + this.metrics.failedCities)) * 100).toFixed(2) : 0}%`);
    console.log(`📊 Data Stats:`);
    console.log(`   - Total Listings: ${this.metrics.totalListings}`);
    console.log(`   - Just Listed: ${this.detectionResults.justListed.length}`);
    console.log(`   - Sold: ${this.detectionResults.soldListings.length}`);
    console.log(`🔧 Enterprise Features:`);
    console.log(`   - Health Checks: ✅`);
    console.log(`   - Batch Processing: ✅`);
    console.log(`   - Error Handling: ✅`);
    console.log(`   - Email Notifications: ✅`);
    console.log(`   - Monitoring: ✅`);
    console.log('='.repeat(60));
  }

  // Handle errors
  async handleError(error) {
    console.error('❌ Enterprise orchestrator error:', error);
    
    // Send error notification
    if (ENTERPRISE_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
      try {
        const emailData = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          enterpriseMetrics: {
            regionsProcessed: this.metrics.regionsProcessed,
            successfulCities: this.metrics.successfulCities,
            failedCities: this.metrics.failedCities,
            totalDuration: Math.floor((Date.now() - this.startTime) / 1000)
          }
        };
        
        await sendScrapeNotification(emailData);
      } catch (emailError) {
        console.error('❌ Failed to send error notification:', emailError.message);
      }
    }
  }
}

// Create and export orchestrator instance
const orchestrator = new SimpleEnterpriseOrchestrator();

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  orchestrator.runEnterpriseScrape().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default orchestrator;
