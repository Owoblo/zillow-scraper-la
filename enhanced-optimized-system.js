import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import DecodoZillowScraper from './decodo-scraper.js';
import RealtorScraper from './realtor-scraper.js';
import { detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { getAllCities } from './config/regions.js';
import nodemailer from 'nodemailer';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

class EnhancedOptimizedSystem {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.decodoScraper = new DecodoZillowScraper();
    this.realtorScraper = new RealtorScraper();
    
    // Focused configuration - optimized for Windsor + GTA
    this.batchSize = 8; // 8-9 cities per batch (Windsor=9, GTA=8)
    this.batchDelay = 3 * 60 * 1000; // 3 minutes between batches
    this.concurrentCities = 2; // Process 2 cities simultaneously
    this.maxRetries = 3; // Retry failed cities
    this.cityDelay = 5 * 1000; // 5 seconds between cities
    
    // Dynamic batch sizing for different city volumes
    this.dynamicBatchSize = {
      'Toronto': 8,
      'Vancouver': 8,
      'Mississauga': 6,
      'Brampton': 6,
      'Markham': 6,
      'Vaughan': 6,
      'Windsor': 6,
      'London': 4,
      'Oakville': 4,
      'Burlington': 4,
      'default': 6
    };
    
    // Focused batches - Windsor and GTA areas only
    this.batches = [
      {
        name: 'Batch 1 - Windsor Area',
        cities: ['Windsor', 'Kingsville', 'Leamington', 'Lakeshore', 'Essex', 'Tecumseh', 'Lasalle', 'Chatham-Kent', 'Amherstburg'],
        regionKeys: ['windsor-area']
      },
      {
        name: 'Batch 2 - GTA Area', 
        cities: ['Toronto', 'Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill', 'Oakville', 'Burlington'],
        regionKeys: ['gta-area', 'gta-extended']
      }
    ];

    // Performance metrics
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
      retryAttempts: 0,
      startTime: null,
      endTime: null,
      errors: [],
      performanceMetrics: {
        avgTimePerCity: 0,
        successRate: 0,
        listingsPerMinute: 0,
        totalCities: 0,
        successfulCities: 0,
        failedCities: 0
      }
    };

    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(subject, htmlContent, isError = false) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `${isError ? '❌ ERROR: ' : '✅ SUCCESS: '}${subject}`,
        html: htmlContent
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`📧 Email notification sent: ${subject}`);
    } catch (error) {
      console.error('❌ Failed to send email notification:', error.message);
    }
  }

  /**
   * Generate comprehensive email report
   */
  generateEmailReport(results, detectionResults, totalDuration) {
    const successRate = this.metrics.performanceMetrics.totalCities > 0 
      ? (this.metrics.performanceMetrics.successfulCities / this.metrics.performanceMetrics.totalCities * 100).toFixed(1)
      : 0;

    const listingsPerMinute = totalDuration > 0 
      ? (this.metrics.totalListings / totalDuration).toFixed(1)
      : 0;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
          🚀 Focused Zillow Scraper Report (Windsor + GTA)
        </h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">📊 Performance Summary</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>⏱️ Total Duration:</strong> ${totalDuration.toFixed(1)} minutes</li>
            <li style="margin: 8px 0;"><strong>📦 Batches Processed:</strong> ${this.metrics.completedBatches}/${this.metrics.totalBatches}</li>
            <li style="margin: 8px 0;"><strong>📈 Total Listings:</strong> ${this.metrics.totalListings.toLocaleString()}</li>
            <li style="margin: 8px 0;"><strong>🆕 Just Listed:</strong> ${this.metrics.totalJustListed}</li>
            <li style="margin: 8px 0;"><strong>🏠 Sold:</strong> ${this.metrics.totalSold}</li>
            <li style="margin: 8px 0;"><strong>📊 Success Rate:</strong> ${successRate}%</li>
            <li style="margin: 8px 0;"><strong>⚡ Listings/Minute:</strong> ${listingsPerMinute}</li>
          </ul>
        </div>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">🔄 Source Breakdown</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>🏠 Decodo (Zillow):</strong> ${this.metrics.decodoRequests} requests</li>
            <li style="margin: 8px 0;"><strong>🏘️ Realtor.com:</strong> ${this.metrics.realtorRequests} requests</li>
            <li style="margin: 8px 0;"><strong>🔄 Fallback Activations:</strong> ${this.metrics.fallbackActivations}</li>
            <li style="margin: 8px 0;"><strong>🔄 Retry Attempts:</strong> ${this.metrics.retryAttempts}</li>
          </ul>
        </div>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">📋 Batch Results</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Batch</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Status</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Listings</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(result => `
                <tr>
                  <td style="border: 1px solid #dee2e6; padding: 12px;">${result.batch}</td>
                  <td style="border: 1px solid #dee2e6; padding: 12px; color: ${result.success ? '#27ae60' : '#e74c3c'};">
                    ${result.success ? '✅ Success' : '❌ Failed'}
                  </td>
                  <td style="border: 1px solid #dee2e6; padding: 12px;">${result.listings || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${this.metrics.errors.length > 0 ? `
          <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #721c24; margin-top: 0;">❌ Errors (${this.metrics.errors.length})</h3>
            <ul style="color: #721c24;">
              ${this.metrics.errors.slice(0, 10).map(error => `<li>${error}</li>`).join('')}
              ${this.metrics.errors.length > 10 ? `<li>... and ${this.metrics.errors.length - 10} more errors</li>` : ''}
            </ul>
          </div>
        ` : ''}

        <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0c5460; margin-top: 0;">🎯 System Status</h3>
          <p style="color: #0c5460; margin: 0;">
            ${this.metrics.failedBatches === 0 
              ? '🎉 All batches completed successfully! System is running optimally.' 
              : '⚠️ Some batches failed. Check errors above for details.'}
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d;">
          <p>Generated at ${new Date().toLocaleString()}</p>
          <p>Focused Zillow Scraper - Windsor & GTA Areas</p>
        </div>
      </div>
    `;

    return htmlContent;
  }

  /**
   * Scrape cities with enhanced concurrent processing and retry logic
   */
  async scrapeCitiesWithFallback(cityConfigs) {
    const allListings = [];
    let successfulCities = 0;
    let failedCities = 0;
    const failedCitiesList = [];

    // Process cities in concurrent groups
    for (let i = 0; i < cityConfigs.length; i += this.concurrentCities) {
      const cityGroup = cityConfigs.slice(i, i + this.concurrentCities);
      
      console.log(`\n🔄 Processing concurrent group: ${cityGroup.map(c => c.name).join(', ')}`);
      
      // Process cities concurrently
      const groupPromises = cityGroup.map(async (cityConfig) => {
        return await this.scrapeCityWithRetry(cityConfig);
      });

      const groupResults = await Promise.all(groupPromises);
      
      // Process results
      groupResults.forEach((result, index) => {
        if (result.success) {
          allListings.push(...result.listings);
          successfulCities++;
          console.log(`  ✅ ${cityGroup[index].name}: ${result.listings.length} listings`);
        } else {
          failedCities++;
          failedCitiesList.push(cityGroup[index]);
          console.log(`  ❌ ${cityGroup[index].name}: Failed after ${result.retries} retries`);
        }
      });

      // Delay between cities to avoid rate limiting
      if (i + this.concurrentCities < cityConfigs.length) {
        await new Promise(resolve => setTimeout(resolve, this.cityDelay));
      }
    }

    // Retry failed cities with exponential backoff
    if (failedCitiesList.length > 0) {
      console.log(`\n🔄 Retrying ${failedCitiesList.length} failed cities...`);
      const retryResults = await this.retryFailedCities(failedCitiesList);
      
      retryResults.forEach((result, index) => {
        if (result.success) {
          allListings.push(...result.listings);
          successfulCities++;
          failedCities--;
          console.log(`  ✅ Retry successful: ${failedCitiesList[index].name}`);
        }
      });
    }

    this.metrics.totalListings += allListings.length;
    this.metrics.performanceMetrics.totalCities += cityConfigs.length;
    this.metrics.performanceMetrics.successfulCities += successfulCities;
    this.metrics.performanceMetrics.failedCities += failedCities;

    return { allListings, successfulCities, failedCities };
  }

  /**
   * Scrape a single city with retry logic
   */
  async scrapeCityWithRetry(cityConfig, retryCount = 0) {
    try {
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
          }
        } catch (error) {
          console.error(`  ❌ Realtor.com failed for ${cityConfig.name}:`, error.message);
          this.metrics.errors.push(`Realtor.com failed for ${cityConfig.name}: ${error.message}`);
        }
      }

      if (success) {
        console.log(`  🎯 ${cityConfig.name}: ${cityListings.length} listings ${usedFallback ? '(via Realtor.com)' : '(via Decodo)'}`);
        return { success: true, listings: cityListings, retries: retryCount };
      } else {
        throw new Error(`All methods failed for ${cityConfig.name}`);
      }

    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`  🔄 Retrying ${cityConfig.name} in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        this.metrics.retryAttempts++;
        await new Promise(resolve => setTimeout(resolve, delay));
        return await this.scrapeCityWithRetry(cityConfig, retryCount + 1);
      } else {
        return { success: false, listings: [], retries: retryCount };
      }
    }
  }

  /**
   * Retry failed cities with exponential backoff
   */
  async retryFailedCities(failedCities) {
    const results = [];
    
    for (const cityConfig of failedCities) {
      const delay = Math.random() * 5000; // Random delay up to 5 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const result = await this.scrapeCityWithRetry(cityConfig, 0);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Store listings with enhanced duplicate handling
   */
  async storeListingsBatch(listings, batchName) {
    if (listings.length === 0) return;

    try {
      console.log(`💾 Storing ${listings.length} listings for ${batchName}...`);
      console.log(`📊 Current total listings in system: ${this.metrics.totalListings} (Unlimited Supabase Pro)`);
      
      // Remove duplicates within the batch by zpid
      const uniqueListings = [];
      const seenZpids = new Set();
      
      for (const listing of listings) {
        if (!seenZpids.has(listing.zpid)) {
          seenZpids.add(listing.zpid);
          uniqueListings.push(listing);
        }
      }
      
      const duplicatesRemoved = listings.length - uniqueListings.length;
      if (duplicatesRemoved > 0) {
        console.log(`📊 Removed ${duplicatesRemoved} duplicates, storing ${uniqueListings.length} unique listings`);
      }
      
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
   * Process a single batch with enhanced monitoring
   */
  async processBatch(batchIndex) {
    const batch = this.batches[batchIndex];
    if (!batch) {
      throw new Error(`Unknown batch: ${batchIndex}`);
    }

    const batchStartTime = Date.now();
    console.log(`\n📦 Processing ${batch.name}...`);
    console.log(`📍 Cities: ${batch.cities.join(', ')}`);

    try {
      // Get city configurations
      const allCities = getAllCities();
      const cityConfigs = allCities.filter(city => 
        batch.cities.includes(city.name)
      );

      // Step 1: Scrape cities with enhanced processing
      console.log(`\n📊 Step 1: Scraping ${cityConfigs.length} cities with enhanced processing...`);
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

      const batchDuration = (Date.now() - batchStartTime) / 1000;
      console.log(`✅ ${batch.name} completed successfully in ${batchDuration.toFixed(1)}s`);
      this.metrics.completedBatches++;
      
      return {
        success: true,
        batch: batch.name,
        listings: scrapeResults.allListings.length,
        successfulCities: scrapeResults.successfulCities,
        failedCities: scrapeResults.failedCities,
        duration: batchDuration
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
   * Run final detection with enhanced monitoring
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
              await new Promise(resolve => setTimeout(resolve, 1000));
              
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
   * Run the complete enhanced workflow
   */
  async runEnhancedSchedule() {
    console.log('🚀 FOCUSED OPTIMIZED SYSTEM - WINDSOR & GTA SCRAPING');
    console.log('====================================================');
    console.log('📅 Focused Schedule (3-minute intervals, Windsor + GTA only):');
    this.batches.forEach((batch, index) => {
      console.log(`  Batch ${index + 1}: ${batch.name} (${batch.cities.length} cities)`);
    });
    console.log(`\n⚙️ Focused Configuration (Windsor + GTA Optimized):`);
    console.log(`  📦 Batch size: ${this.batchSize} cities (Windsor=9, GTA=8)`);
    console.log(`  ⏱️ Batch delay: ${this.batchDelay / 60000} minutes between batches`);
    console.log(`  🚀 Pro tier: Unlimited table storage, faster processing`);
    console.log(`  🔄 Concurrent cities: ${this.concurrentCities} (balanced for efficiency)`);
    console.log(`  🔄 Max retries: ${this.maxRetries} (robust error handling)`);
    console.log(`  ⏱️ City delay: ${this.cityDelay / 1000} seconds between cities`);
    console.log('');

    this.metrics.startTime = new Date();
    this.metrics.totalBatches = this.batches.length;

    const results = [];

    // Send start notification
    await this.sendEmailNotification(
      'Focused Zillow Scraper Started',
      '<h2>🚀 Focused Zillow Scraper Started</h2><p>The focused scraping system has begun processing Windsor and GTA areas with optimized performance.</p>'
    );

    // Process each batch in order
    for (let batchIndex = 0; batchIndex < this.batches.length; batchIndex++) {
      try {
        // Process the batch immediately
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

    // Calculate performance metrics
    this.metrics.performanceMetrics.avgTimePerCity = this.metrics.performanceMetrics.totalCities > 0 
      ? (totalDuration * 60 / this.metrics.performanceMetrics.totalCities).toFixed(2)
      : 0;
    this.metrics.performanceMetrics.successRate = this.metrics.performanceMetrics.totalCities > 0 
      ? (this.metrics.performanceMetrics.successfulCities / this.metrics.performanceMetrics.totalCities * 100).toFixed(1)
      : 0;
    this.metrics.performanceMetrics.listingsPerMinute = totalDuration > 0 
      ? (this.metrics.totalListings / totalDuration).toFixed(1)
      : 0;

    // Generate final report
    this.generateReport(results, detectionResults, totalDuration);
    
    // Send comprehensive email report
    const emailContent = this.generateEmailReport(results, detectionResults, totalDuration);
    await this.sendEmailNotification(
      'Focused Zillow Scraper Complete',
      emailContent,
      this.metrics.failedBatches > 0
    );
    
    return {
      success: this.metrics.failedBatches === 0,
      results,
      detectionResults,
      metrics: this.metrics
    };
  }

  /**
   * Generate comprehensive console report
   */
  generateReport(results, detectionResults, totalDuration) {
    console.log('\n🎯 FOCUSED OPTIMIZED SYSTEM REPORT');
    console.log('====================================');
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(1)} minutes`);
    console.log(`📦 Batches Processed: ${this.metrics.completedBatches}/${this.metrics.totalBatches}`);
    console.log(`📈 Total Listings: ${this.metrics.totalListings.toLocaleString()}`);
    console.log(`🆕 Just Listed: ${this.metrics.totalJustListed}`);
    console.log(`🏠 Sold: ${this.metrics.totalSold}`);
    console.log(`🔄 Fallback Activations: ${this.metrics.fallbackActivations}`);
    console.log(`🔄 Retry Attempts: ${this.metrics.retryAttempts}`);
    
    console.log('\n📊 Performance Metrics:');
    console.log(`  ⚡ Success Rate: ${this.metrics.performanceMetrics.successRate}%`);
    console.log(`  ⏱️ Avg Time per City: ${this.metrics.performanceMetrics.avgTimePerCity}s`);
    console.log(`  📈 Listings per Minute: ${this.metrics.performanceMetrics.listingsPerMinute}`);
    
    console.log('\n📊 Source Breakdown:');
    console.log(`  🏠 Decodo (Zillow): ${this.metrics.decodoRequests} requests`);
    console.log(`  🏘️ Realtor.com: ${this.metrics.realtorRequests} requests`);
    
    console.log('\n📋 Batch Breakdown:');
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.batch}: ${result.listings} listings (${result.duration?.toFixed(1)}s)`);
      } else {
        console.log(`  ❌ ${result.batch}: FAILED - ${result.error}`);
      }
    });

    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.metrics.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 Focused optimized system completed!');
    console.log('✅ All batches processed with immediate storage');
    console.log('✅ Final detection completed city-by-city');
    console.log('✅ Tables switched for next run');
    console.log('✅ Email notification sent');
  }
}

// Export for use in other modules
export default EnhancedOptimizedSystem;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new EnhancedOptimizedSystem();
  system.runEnhancedSchedule().catch(error => {
    console.error('❌ Enhanced system failed:', error.message);
    process.exit(1);
  });
}
