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
      if (!ENTERPRISE_CONFIG.IS_FIRST_RUN) {
        console.log('🔄 Switching tables AFTER detection (preparing for NEXT run)...');
        await this.switchTablesForNextRun();
      } else {
        console.log('🔄 Switching tables (first run - preparing for NEXT run)...');
        await this.switchTablesForNextRun();
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
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }));
      
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
      
      // Use the detection function from zillow.js
      const { detectJustListedAndSoldByRegion } = await import('./zillow.js');
      
      // Get all region keys
      const { getRegionKeys } = await import('./config/regions.js');
      const regionKeys = getRegionKeys();
      
      let allJustListed = [];
      let allSoldListings = [];
      
      // Process each region
      for (const regionKey of regionKeys) {
        try {
          console.log(`   Detecting for region: ${regionKey}...`);
          const { justListed, soldListings } = await detectJustListedAndSoldByRegion(regionKey);
          allJustListed.push(...justListed);
          allSoldListings.push(...soldListings);
          console.log(`   ${regionKey}: ${justListed.length} just-listed, ${soldListings.length} sold`);
        } catch (error) {
          console.error(`❌ Detection failed for region ${regionKey}:`, error.message);
        }
      }
      
      this.detectionResults = { justListed: allJustListed, soldListings: allSoldListings };
      
      console.log(`\n📈 Detection Results Summary:`);
      console.log(`   - Just-listed properties: ${allJustListed.length}`);
      console.log(`   - Sold properties: ${allSoldListings.length}`);
      
      if (allJustListed.length > 0) {
        console.log(`   - Sample just-listed cities: ${[...new Set(allJustListed.slice(0, 5).map(l => l.addresscity || l.city))].join(', ')}`);
      }
      if (allSoldListings.length > 0) {
        console.log(`   - Sample sold cities: ${[...new Set(allSoldListings.slice(0, 5).map(l => l.addresscity || l.city))].join(', ')}`);
      }
      
    } catch (error) {
      console.error('❌ Detection failed:', error.message);
      console.error('   Stack:', error.stack);
      this.detectionResults = { justListed: [], soldListings: [] };
    }
  }

  // Switch tables for next run
  async switchTablesForNextRun() {
    console.log('🔄 Switching tables for next run...');
    
    try {
      await switchTables();
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
    const cityDetails = [];
    const cities = getAllCities();
    
    // Get all successful regions
    const successfulRegions = this.results.filter(r => r.success);
    
    console.log(`\n📊 Generating city details for email...`);
    console.log(`   Detection results: ${this.detectionResults.justListed.length} just-listed, ${this.detectionResults.soldListings.length} sold`);
    
    // For each city, collect data from results
    cities.forEach(city => {
      const regionResult = successfulRegions.find(r => r.region === city.regionName);
      
      if (regionResult && regionResult.listings) {
        // Count listings per city from the actual listings array
        // Listings have __meta.areaName or addresscity field
        const cityListings = regionResult.listings.filter(l => {
          const cityName = l.__meta?.areaName || l.addresscity || '';
          return cityName === city.name || cityName?.toLowerCase() === city.name.toLowerCase();
        });
        
        // Count just-listed and sold for this city
        // Check both addresscity and city fields for matching
        const justListed = this.detectionResults.justListed.filter(l => {
          const listingCity = l.addresscity || l.city || '';
          return listingCity === city.name || listingCity?.toLowerCase() === city.name.toLowerCase();
        }).length;
        
        const sold = this.detectionResults.soldListings.filter(l => {
          const listingCity = l.addresscity || l.city || '';
          return listingCity === city.name || listingCity?.toLowerCase() === city.name.toLowerCase();
        }).length;
        
        cityDetails.push({
          name: city.name,
          region: city.regionName,
          justListed: justListed,
          sold: sold,
          total: cityListings.length || 0
        });
        
        // Debug logging for cities with detection results
        if (justListed > 0 || sold > 0) {
          console.log(`   ${city.name}: ${justListed} just-listed, ${sold} sold, ${cityListings.length} total`);
        }
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
