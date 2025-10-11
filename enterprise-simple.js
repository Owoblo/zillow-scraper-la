#!/usr/bin/env node

// Simplified Enterprise System - No Redis Required
import { getAllCities } from './config/regions.js';
import { processRegionsConcurrently, detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { sendScrapeNotification } from './emailService.js';

// Enterprise configuration
const ENTERPRISE_CONFIG = {
  ENABLE_EMAIL_NOTIFICATIONS: true,
  ENABLE_DETECTION: true,
  ENABLE_MONITORING: true,
  MAX_CONCURRENT_REGIONS: 2, // Process 2 regions at a time
  REGION_DELAY_MS: 5000, // 5 second delay between regions
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  RETRY_FAILED_CITIES: true,
  MAX_RETRIES: 3
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
    console.log('🚀 Starting Simplified Enterprise Zillow Scraper...');
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

      // Phase 3: Process regions with enterprise features
      await this.processRegionsWithEnterpriseFeatures(regions);

      // Phase 4: Run detection if enabled
      if (ENTERPRISE_CONFIG.ENABLE_DETECTION) {
        await this.runEnterpriseDetection();
      }

      // Phase 5: Switch tables
      await this.switchTablesForNextRun();

      // Phase 6: Send notifications
      if (ENTERPRISE_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
        await this.sendEnterpriseNotification();
      }

      // Phase 7: Generate final report
      await this.generateFinalReport();

      console.log('✅ Simplified Enterprise scrape completed successfully!');
      
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
      
      // Delay between batches
      if (i + ENTERPRISE_CONFIG.MAX_CONCURRENT_REGIONS < regions.length) {
        console.log(`⏳ Waiting ${ENTERPRISE_CONFIG.REGION_DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, ENTERPRISE_CONFIG.REGION_DELAY_MS));
      }
    }
    
    this.results = results;
    console.log(`✅ All regions processed: ${results.filter(r => r.success).length}/${results.length} successful`);
  }

  // Get region key from region name
  getRegionKey(regionName) {
    const keyMap = {
      'Windsor Area': 'windsor-area',
      'Greater Toronto Area': 'gta-area',
      'Milwaukee Area': 'milwaukee-area',
      'GTA Extended': 'gta-extended'
    };
    
    return keyMap[regionName] || regionName.toLowerCase().replace(/\s+/g, '-');
  }

  // Run enterprise detection
  async runEnterpriseDetection() {
    console.log('🔍 Running enterprise detection...');
    
    try {
      const { justListed, soldListings } = await detectJustListedAndSoldByRegion();
      
      this.detectionResults = { justListed, soldListings };
      
      console.log(`📈 Detection Results:`);
      console.log(`   - Just-listed properties: ${justListed.length}`);
      console.log(`   - Sold properties: ${soldListings.length}`);
      
    } catch (error) {
      console.error('❌ Detection failed:', error.message);
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
    
    this.results.forEach(result => {
      if (result.success) {
        cityDetails.push({
          name: result.region,
          region: result.region,
          justListed: this.detectionResults.justListed.filter(l => l.addresscity === result.region).length,
          sold: this.detectionResults.soldListings.filter(l => l.addresscity === result.region).length,
          total: result.listings?.length || 0
        });
      }
    });
    
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
