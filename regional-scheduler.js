import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import HybridZillowScraper from './hybrid-scraper.js';
import { detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { getAllCities, getRegionKeys } from './config/regions.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

class RegionalScheduler {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.scraper = new HybridZillowScraper();
    
    // Regional configuration with time staggering
    this.regions = {
      'south': {
        name: 'South Canada',
        regions: ['windsor-area'],
        startTime: '04:00',
        delay: 0, // minutes after start
        cities: ['Windsor', 'Kingsville', 'Leamington', 'Lakeshore', 'Essex', 'Tecumseh', 'Lasalle', 'Chatham-Kent', 'Amherstburg']
      },
      'east': {
        name: 'East Canada', 
        regions: ['gta-area'],
        startTime: '04:10',
        delay: 10, // minutes after start
        cities: ['Toronto', 'Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill']
      },
      'west': {
        name: 'West Canada',
        regions: ['western-canada'],
        startTime: '04:20', 
        delay: 20, // minutes after start
        cities: ['Vancouver']
      },
      'north': {
        name: 'North Canada',
        regions: ['southwestern-ontario'],
        startTime: '04:30',
        delay: 30, // minutes after start  
        cities: ['London']
      },
      'extended': {
        name: 'Extended GTA',
        regions: ['gta-extended'],
        startTime: '04:40',
        delay: 40, // minutes after start
        cities: ['Oakville', 'Burlington']
      }
    };

    this.metrics = {
      totalRegions: 0,
      completedRegions: 0,
      failedRegions: 0,
      totalListings: 0,
      totalJustListed: 0,
      totalSold: 0,
      startTime: null,
      endTime: null,
      errors: []
    };
  }

  /**
   * Calculate delay until next regional batch
   */
  calculateDelay(regionKey) {
    const region = this.regions[regionKey];
    if (!region) return 0;

    const now = new Date();
    const [hours, minutes] = region.startTime.split(':').map(Number);
    
    // Create target time for today
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    // If target time has passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const delayMs = targetTime.getTime() - now.getTime();
    return Math.max(0, delayMs);
  }

  /**
   * Wait for the scheduled time for a region
   */
  async waitForScheduledTime(regionKey) {
    const delayMs = this.calculateDelay(regionKey);
    
    if (delayMs > 0) {
      const delayMinutes = Math.round(delayMs / 60000);
      console.log(`⏰ Waiting ${delayMinutes} minutes for ${this.regions[regionKey].name} (${this.regions[regionKey].startTime})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Process a single region: scrape → store → detect → switch tables
   */
  async processRegion(regionKey) {
    const region = this.regions[regionKey];
    if (!region) {
      throw new Error(`Unknown region: ${regionKey}`);
    }

    console.log(`\n🏙️ Processing ${region.name}...`);
    console.log(`📍 Cities: ${region.cities.join(', ')}`);
    console.log(`⏰ Scheduled for: ${region.startTime}`);

    try {
      // Step 1: Scrape cities in this region
      console.log(`\n📊 Step 1: Scraping ${region.cities.length} cities...`);
      const scrapeResults = await this.scraper.scrapeCities('decodo', region.cities);
      
      if (!scrapeResults.success) {
        throw new Error(`Scraping failed: ${scrapeResults.errors.join(', ')}`);
      }

      console.log(`✅ Scraped ${scrapeResults.totalListings} listings in ${scrapeResults.duration.toFixed(1)}s`);
      this.metrics.totalListings += scrapeResults.totalListings;

      // Step 2: Wait a bit for data to settle
      console.log(`\n⏳ Step 2: Waiting 30 seconds for data to settle...`);
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Step 3: Run detection for this region
      console.log(`\n🔍 Step 3: Running detection for ${region.name}...`);
      const detectionResults = await this.runRegionalDetection(region.regions);
      
      console.log(`✅ Detection complete: ${detectionResults.justListed} just-listed, ${detectionResults.sold} sold`);
      this.metrics.totalJustListed += detectionResults.justListed;
      this.metrics.totalSold += detectionResults.sold;

      // Step 4: Switch tables for this region
      console.log(`\n🔄 Step 4: Switching tables for ${region.name}...`);
      await this.switchRegionalTables(region.regions);

      console.log(`✅ ${region.name} completed successfully!`);
      this.metrics.completedRegions++;
      
      return {
        success: true,
        region: region.name,
        listings: scrapeResults.totalListings,
        justListed: detectionResults.justListed,
        sold: detectionResults.sold,
        duration: scrapeResults.duration
      };

    } catch (error) {
      console.error(`❌ ${region.name} failed:`, error.message);
      this.metrics.failedRegions++;
      this.metrics.errors.push(`${region.name}: ${error.message}`);
      
      return {
        success: false,
        region: region.name,
        error: error.message
      };
    }
  }

  /**
   * Run detection for specific regions
   */
  async runRegionalDetection(regionKeys) {
    try {
      const allCities = getAllCities();
      const regionCities = allCities.filter(city => 
        regionKeys.includes(city.regionKey)
      );

      console.log(`🔍 Running detection for ${regionCities.length} cities in regions: ${regionKeys.join(', ')}`);

      let totalJustListed = 0;
      let totalSold = 0;

      // Process each city individually to prevent timeouts
      for (const city of regionCities) {
        try {
          console.log(`  📍 Detecting for ${city.name}...`);
          const cityResults = await detectJustListedAndSoldByRegion(city.regionKey);
          
          const cityJustListed = cityResults.justListed || 0;
          const citySold = cityResults.sold || 0;
          
          totalJustListed += cityJustListed;
          totalSold += citySold;
          
          console.log(`    ✅ ${city.name}: ${cityJustListed} just-listed, ${citySold} sold`);
          
          // Small delay between cities
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.warn(`    ⚠️ Detection failed for ${city.name}: ${error.message}`);
        }
      }

      return { justListed: totalJustListed, sold: totalSold };

    } catch (error) {
      console.error(`❌ Regional detection failed:`, error.message);
      return { justListed: 0, sold: 0 };
    }
  }

  /**
   * Switch tables for specific regions
   */
  async switchRegionalTables(regionKeys) {
    try {
      for (const regionKey of regionKeys) {
        console.log(`  🔄 Switching tables for region: ${regionKey}`);
        await switchTables(regionKey);
      }
      console.log(`✅ Tables switched for regions: ${regionKeys.join(', ')}`);
    } catch (error) {
      console.error(`❌ Table switching failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run the complete regional schedule
   */
  async runSchedule() {
    console.log('🚀 REGIONAL SCHEDULER - CANADA WIDE SCRAPING');
    console.log('=============================================');
    console.log('📅 Schedule:');
    Object.entries(this.regions).forEach(([key, region]) => {
      console.log(`  ${region.startTime} - ${region.name} (${region.cities.length} cities)`);
    });
    console.log('');

    this.metrics.startTime = new Date();
    this.metrics.totalRegions = Object.keys(this.regions).length;

    const results = [];

    // Process each region in order
    for (const regionKey of Object.keys(this.regions)) {
      try {
        // Wait for scheduled time
        await this.waitForScheduledTime(regionKey);
        
        // Process the region
        const result = await this.processRegion(regionKey);
        results.push(result);
        
        // Small delay between regions
        if (regionKey !== Object.keys(this.regions)[Object.keys(this.regions).length - 1]) {
          console.log(`\n⏳ Waiting 2 minutes before next region...`);
          await new Promise(resolve => setTimeout(resolve, 120000));
        }
        
      } catch (error) {
        console.error(`❌ Region ${regionKey} failed:`, error.message);
        this.metrics.errors.push(`Region ${regionKey}: ${error.message}`);
      }
    }

    this.metrics.endTime = new Date();
    const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000 / 60; // minutes

    // Generate final report
    this.generateReport(results, totalDuration);
    
    return {
      success: this.metrics.failedRegions === 0,
      results,
      metrics: this.metrics
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport(results, totalDuration) {
    console.log('\n🎯 REGIONAL SCHEDULER REPORT');
    console.log('=============================');
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(1)} minutes`);
    console.log(`📊 Regions Processed: ${this.metrics.completedRegions}/${this.metrics.totalRegions}`);
    console.log(`📈 Total Listings: ${this.metrics.totalListings}`);
    console.log(`🆕 Just Listed: ${this.metrics.totalJustListed}`);
    console.log(`🏠 Sold: ${this.metrics.totalSold}`);
    
    console.log('\n📋 Regional Breakdown:');
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.region}: ${result.listings} listings, ${result.justListed} just-listed, ${result.sold} sold`);
      } else {
        console.log(`  ❌ ${result.region}: FAILED - ${result.error}`);
      }
    });

    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.metrics.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 Regional scheduling completed!');
  }
}

// Export for use in other modules
export default RegionalScheduler;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new RegionalScheduler();
  scheduler.runSchedule().catch(error => {
    console.error('❌ Regional scheduler failed:', error.message);
    process.exit(1);
  });
}
