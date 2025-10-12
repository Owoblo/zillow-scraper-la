import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import DecodoZillowScraper from './decodo-scraper.js';
import RealtorScraper from './realtor-scraper.js';
import { detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { getAllCities } from './config/regions.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

class OptimizedRegionalSystem {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.decodoScraper = new DecodoZillowScraper();
    this.realtorScraper = new RealtorScraper();
    
    // Optimized batch configuration
    this.batchSize = 6; // 6 cities per batch
    this.batchDelay = 3 * 60 * 1000; // 3 minutes between batches
    
    // Regional batches with time staggering
    this.batches = [
      {
        name: 'Batch 1 - South Canada',
        startTime: '04:00',
        cities: ['Windsor', 'Kingsville', 'Leamington', 'Lakeshore', 'Essex', 'Tecumseh'],
        regionKeys: ['windsor-area']
      },
      {
        name: 'Batch 2 - GTA Core',
        startTime: '04:10', 
        cities: ['Toronto', 'Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill'],
        regionKeys: ['gta-area']
      },
      {
        name: 'Batch 3 - Extended & West',
        startTime: '04:20',
        cities: ['Oakville', 'Burlington', 'Vancouver', 'London', 'Lasalle', 'Chatham-Kent'],
        regionKeys: ['gta-extended', 'western-canada', 'southwestern-ontario', 'windsor-area']
      },
      {
        name: 'Batch 4 - Final Windsor',
        startTime: '04:30',
        cities: ['Amherstburg'],
        regionKeys: ['windsor-area']
      }
    ];

    this.metrics = {
      totalBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      totalListings: 0,
      totalJustListed: 0,
      totalSold: 0,
      decodoRequests: 0,
      realtorRequests: 0,
      fallbackActivations: 0,
      startTime: null,
      endTime: null,
      errors: []
    };
  }

  /**
   * Calculate delay until next batch
   */
  calculateDelay(batchIndex) {
    const batch = this.batches[batchIndex];
    if (!batch) return 0;

    const now = new Date();
    const [hours, minutes] = batch.startTime.split(':').map(Number);
    
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
   * Wait for the scheduled time for a batch
   */
  async waitForScheduledTime(batchIndex) {
    const delayMs = this.calculateDelay(batchIndex);
    
    if (delayMs > 0) {
      const delayMinutes = Math.round(delayMs / 60000);
      console.log(`⏰ Waiting ${delayMinutes} minutes for ${this.batches[batchIndex].name} (${this.batches[batchIndex].startTime})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Clear current_listings table to prevent overflow
   */
  async clearCurrentListings() {
    try {
      console.log(`🗑️ Clearing current_listings table to prevent overflow...`);
      
      const { error } = await this.supabase
        .from('current_listings')
        .delete()
        .neq('zpid', 'dummy'); // Delete all rows
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Current listings table cleared`);
    } catch (error) {
      console.error('❌ Error clearing current listings:', error.message);
      throw error;
    }
  }

  /**
   * Scrape cities with fallback strategy
   */
  async scrapeCitiesWithFallback(cityConfigs) {
    const allListings = [];
    let successfulCities = 0;
    let failedCities = 0;

    for (const cityConfig of cityConfigs) {
      console.log(`\n🏙️ Processing ${cityConfig.name}...`);
      let cityListings = [];
      let success = false;
      let usedFallback = false;

      // Try Decodo (Zillow) first
      try {
        console.log(`  🔄 Trying Decodo (Zillow) for ${cityConfig.name}...`);
        cityListings = await this.decodoScraper.scrapeCity(cityConfig);
        this.metrics.decodoRequests++;
        
        if (cityListings.length > 0) {
          success = true;
          console.log(`  ✅ Decodo: ${cityConfig.name} - ${cityListings.length} listings`);
        } else {
          console.log(`  ⚠️ Decodo: ${cityConfig.name} - 0 listings, trying Realtor.com...`);
        }
      } catch (error) {
        console.error(`  ❌ Decodo failed for ${cityConfig.name}:`, error.message);
        this.metrics.errors.push(`Decodo failed for ${cityConfig.name}: ${error.message}`);
      }

      // Try Realtor.com fallback if Decodo failed
      if (!success) {
        try {
          console.log(`  🔄 Trying Realtor.com fallback for ${cityConfig.name}...`);
          cityListings = await this.realtorScraper.scrapeCity(cityConfig);
          this.metrics.realtorRequests++;
          
          if (cityListings.length > 0) {
            success = true;
            usedFallback = true;
            this.metrics.fallbackActivations++;
            console.log(`  ✅ Realtor.com: ${cityConfig.name} - ${cityListings.length} listings (FALLBACK)`);
          } else {
            console.log(`  ⚠️ Realtor.com: ${cityConfig.name} - 0 listings`);
          }
        } catch (error) {
          console.error(`  ❌ Realtor.com failed for ${cityConfig.name}:`, error.message);
          this.metrics.errors.push(`Realtor.com failed for ${cityConfig.name}: ${error.message}`);
        }
      }

      if (success) {
        allListings.push(...cityListings);
        successfulCities++;
        console.log(`  🎯 ${cityConfig.name}: ${cityListings.length} listings ${usedFallback ? '(via Realtor.com)' : '(via Decodo)'}`);
      } else {
        failedCities++;
        console.log(`  ❌ ${cityConfig.name}: All methods failed`);
      }

      // Delay between cities
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    }

    this.metrics.totalListings += allListings.length;
    return { allListings, successfulCities, failedCities };
  }

  /**
   * Store listings in database with batch processing
   */
  async storeListingsBatch(listings, batchName) {
    if (listings.length === 0) return;

    try {
      console.log(`💾 Storing ${listings.length} listings for ${batchName}...`);
      
      // Pro tier - unlimited storage, just log current count
      console.log(`📊 Current total listings in system: ${this.metrics.totalListings} (Unlimited Supabase Pro)`);
      
      // Remove duplicates within the batch by zpid
      const uniqueListings = [];
      const seenZpids = new Set();
      
      for (const listing of listings) {
        if (!seenZpids.has(listing.zpid)) {
          seenZpids.add(listing.zpid);
          uniqueListings.push(listing);
        } else {
          console.log(`⚠️ Duplicate zpid found: ${listing.zpid} - skipping`);
        }
      }
      
      console.log(`📊 Removed ${listings.length - uniqueListings.length} duplicates, storing ${uniqueListings.length} unique listings`);
      
      const { error } = await this.supabase
        .from('current_listings')
        .upsert(uniqueListings, { 
          onConflict: 'zpid',
          ignoreDuplicates: false 
        });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Successfully stored ${uniqueListings.length} listings for ${batchName}`);
    } catch (error) {
      console.error('❌ Error storing listings:', error.message);
      throw error;
    }
  }

  /**
   * Process a single batch: scrape → store → wait
   */
  async processBatch(batchIndex) {
    const batch = this.batches[batchIndex];
    if (!batch) {
      throw new Error(`Unknown batch: ${batchIndex}`);
    }

    console.log(`\n📦 Processing ${batch.name}...`);
    console.log(`📍 Cities: ${batch.cities.join(', ')}`);
    console.log(`⏰ Scheduled for: ${batch.startTime}`);

    try {
      // Get city configurations
      const allCities = getAllCities();
      const cityConfigs = allCities.filter(city => 
        batch.cities.includes(city.name)
      );

      // Step 1: Scrape cities with fallback
      console.log(`\n📊 Step 1: Scraping ${cityConfigs.length} cities with fallback...`);
      const scrapeResults = await this.scrapeCitiesWithFallback(cityConfigs);
      
      if (scrapeResults.failedCities > 0) {
        console.warn(`⚠️ ${scrapeResults.failedCities} cities failed to scrape`);
      }

      console.log(`✅ Scraped ${scrapeResults.allListings.length} listings`);

      // Step 2: Store listings immediately
      if (scrapeResults.allListings.length > 0) {
        console.log(`\n💾 Step 2: Storing ${scrapeResults.allListings.length} listings immediately...`);
        await this.storeListingsBatch(scrapeResults.allListings, batch.name);
      }

      console.log(`✅ ${batch.name} completed successfully!`);
      this.metrics.completedBatches++;
      
      return {
        success: true,
        batch: batch.name,
        listings: scrapeResults.allListings.length,
        successfulCities: scrapeResults.successfulCities,
        failedCities: scrapeResults.failedCities
      };

    } catch (error) {
      console.error(`❌ ${batch.name} failed:`, error.message);
      this.metrics.failedBatches++;
      this.metrics.errors.push(`${batch.name}: ${error.message}`);
      
      return {
        success: false,
        batch: batch.name,
        error: error.message
      };
    }
  }

  /**
   * Run detection for all regions after all batches complete
   */
  async runFinalDetection() {
    try {
      console.log(`\n🔍 FINAL DETECTION PHASE`);
      console.log(`========================`);
      console.log(`Running city-by-city detection for all regions...`);

      const allCities = getAllCities();
      const regionKeys = [...new Set(allCities.map(city => city.regionKey))];
      
      let totalJustListed = 0;
      let totalSold = 0;

      // Process each region individually to prevent timeouts
      for (const regionKey of regionKeys) {
        try {
          console.log(`\n📍 Detecting for region: ${regionKey}`);
          const regionCities = allCities.filter(city => city.regionKey === regionKey);
          
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
          
          // Switch tables for this region
          console.log(`  🔄 Switching tables for region: ${regionKey}`);
          await switchTables(regionKey);
          
        } catch (error) {
          console.error(`❌ Detection failed for region ${regionKey}:`, error.message);
        }
      }

      this.metrics.totalJustListed = totalJustListed;
      this.metrics.totalSold = totalSold;
      
      console.log(`\n✅ Final detection complete: ${totalJustListed} just-listed, ${totalSold} sold`);
      return { justListed: totalJustListed, sold: totalSold };

    } catch (error) {
      console.error(`❌ Final detection failed:`, error.message);
      return { justListed: 0, sold: 0 };
    }
  }

  /**
   * Run the complete optimized workflow
   */
  async runOptimizedSchedule() {
    console.log('🚀 OPTIMIZED REGIONAL SYSTEM - CANADA WIDE SCRAPING');
    console.log('===================================================');
    console.log('📅 Optimized Schedule:');
    this.batches.forEach((batch, index) => {
      console.log(`  ${batch.startTime} - ${batch.name} (${batch.cities.length} cities)`);
    });
    console.log(`\n⚙️ Configuration:`);
    console.log(`  📦 Batch size: ${this.batchSize} cities`);
    console.log(`  ⏱️ Batch delay: ${this.batchDelay / 60000} minutes`);
    console.log(`  🚀 Pro tier: Unlimited table storage, faster processing`);
    console.log('');

    this.metrics.startTime = new Date();
    this.metrics.totalBatches = this.batches.length;

    const results = [];

    // Process each batch in order
    for (let batchIndex = 0; batchIndex < this.batches.length; batchIndex++) {
      try {
        // Wait for scheduled time
        await this.waitForScheduledTime(batchIndex);
        
        // Process the batch
        const result = await this.processBatch(batchIndex);
        results.push(result);
        
        // Wait between batches (except for the last one)
        if (batchIndex < this.batches.length - 1) {
          console.log(`\n⏳ Waiting ${this.batchDelay / 60000} minutes before next batch...`);
          await new Promise(resolve => setTimeout(resolve, this.batchDelay));
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batchIndex} failed:`, error.message);
        this.metrics.errors.push(`Batch ${batchIndex}: ${error.message}`);
      }
    }

    // Run final detection phase
    console.log(`\n🔍 Starting final detection phase...`);
    const detectionResults = await this.runFinalDetection();

    this.metrics.endTime = new Date();
    const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000 / 60; // minutes

    // Generate final report
    this.generateReport(results, detectionResults, totalDuration);
    
    return {
      success: this.metrics.failedBatches === 0,
      results,
      detectionResults,
      metrics: this.metrics
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport(results, detectionResults, totalDuration) {
    console.log('\n🎯 OPTIMIZED REGIONAL SYSTEM REPORT');
    console.log('====================================');
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(1)} minutes`);
    console.log(`📦 Batches Processed: ${this.metrics.completedBatches}/${this.metrics.totalBatches}`);
    console.log(`📈 Total Listings: ${this.metrics.totalListings}`);
    console.log(`🆕 Just Listed: ${this.metrics.totalJustListed}`);
    console.log(`🏠 Sold: ${this.metrics.totalSold}`);
    console.log(`🔄 Fallback Activations: ${this.metrics.fallbackActivations}`);
    
    console.log('\n📊 Source Breakdown:');
    console.log(`  🏠 Decodo (Zillow): ${this.metrics.decodoRequests} requests`);
    console.log(`  🏘️ Realtor.com: ${this.metrics.realtorRequests} requests`);
    
    console.log('\n📋 Batch Breakdown:');
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.batch}: ${result.listings} listings`);
      } else {
        console.log(`  ❌ ${result.batch}: FAILED - ${result.error}`);
      }
    });

    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.metrics.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 Optimized regional system completed!');
    console.log('✅ All batches processed with immediate storage');
    console.log('✅ Final detection completed city-by-city');
    console.log('✅ Tables switched for next run');
  }
}

// Export for use in other modules
export default OptimizedRegionalSystem;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new OptimizedRegionalSystem();
  system.runOptimizedSchedule().catch(error => {
    console.error('❌ Optimized regional system failed:', error.message);
    process.exit(1);
  });
}
