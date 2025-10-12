import HybridZillowScraper from './hybrid-scraper.js';
import RealtorScraper from './realtor-scraper.js';
import { getAllCities } from './config/regions.js';
import dotenv from 'dotenv';

dotenv.config();

class EnhancedHybridScraper extends HybridZillowScraper {
  constructor() {
    super();
    this.realtorScraper = new RealtorScraper();
    this.fallbackEnabled = true;
    this.metrics = {
      totalListings: 0,
      decodoRequests: 0,
      currentRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      realtorRequests: 0,
      realtorListings: 0,
      fallbackActivations: 0,
      errors: []
    };
  }

  /**
   * Enhanced scraping with Realtor.com fallback
   */
  async scrapeCities(method = 'enhanced', citiesToScrape = []) {
    console.log(`🚀 Enhanced Hybrid Scraper (Method: ${method})`);
    console.log('===============================================');

    const allCities = getAllCities();
    let cities = citiesToScrape.length > 0
      ? allCities.filter(c => citiesToScrape.includes(c.name))
      : allCities;

    console.log(`📍 Scraping ${cities.length} cities: ${cities.map(c => c.name).join(', ')}`);
    console.log(`🔄 Fallback enabled: ${this.fallbackEnabled}`);

    const startTime = Date.now();
    let allListings = [];
    let successfulCities = 0;
    let failedCities = 0;

    for (const cityConfig of cities) {
      console.log(`\n🏙️ Processing ${cityConfig.name}...`);
      let cityListings = [];
      let success = false;
      let usedFallback = false;

      // Try Zillow first (via Decodo)
      if (method === 'enhanced' || method === 'zillow') {
        try {
          console.log(`  🔄 Trying Zillow (Decodo) for ${cityConfig.name}...`);
          cityListings = await this.decodoScraper.scrapeCity(cityConfig);
          this.metrics.decodoRequests++;
          
          if (cityListings.length > 0) {
            success = true;
            console.log(`  ✅ Zillow: ${cityConfig.name} - ${cityListings.length} listings`);
          } else {
            console.log(`  ⚠️ Zillow: ${cityConfig.name} - 0 listings, trying fallback...`);
          }
        } catch (error) {
          console.error(`  ❌ Zillow failed for ${cityConfig.name}:`, error.message);
          this.metrics.errors.push(`Zillow failed for ${cityConfig.name}: ${error.message}`);
        }
      }

      // Try Realtor.com fallback if Zillow failed or returned no results
      if (!success && this.fallbackEnabled && (method === 'enhanced' || method === 'realtor')) {
        try {
          console.log(`  🔄 Trying Realtor.com fallback for ${cityConfig.name}...`);
          const realtorListings = await this.realtorScraper.scrapeCity(cityConfig);
          this.metrics.realtorRequests++;
          
          if (realtorListings.length > 0) {
            cityListings = realtorListings;
            success = true;
            usedFallback = true;
            this.metrics.fallbackActivations++;
            this.metrics.realtorListings += realtorListings.length;
            console.log(`  ✅ Realtor.com: ${cityConfig.name} - ${realtorListings.length} listings (FALLBACK)`);
          } else {
            console.log(`  ⚠️ Realtor.com: ${cityConfig.name} - 0 listings`);
          }
        } catch (error) {
          console.error(`  ❌ Realtor.com failed for ${cityConfig.name}:`, error.message);
          this.metrics.errors.push(`Realtor.com failed for ${cityConfig.name}: ${error.message}`);
        }
      }

      // Try current system as last resort
      if (!success && (method === 'enhanced' || method === 'current')) {
        try {
          console.log(`  🔄 Trying current system for ${cityConfig.name}...`);
          // This would use the original zillow.js system
          // For now, we'll skip this to focus on the new systems
          console.log(`  ⚠️ Current system fallback not implemented yet`);
        } catch (error) {
          console.error(`  ❌ Current system failed for ${cityConfig.name}:`, error.message);
          this.metrics.errors.push(`Current system failed for ${cityConfig.name}: ${error.message}`);
        }
      }

      if (success) {
        allListings.push(...cityListings);
        this.metrics.successfulRequests++;
        console.log(`  🎯 ${cityConfig.name}: ${cityListings.length} listings ${usedFallback ? '(via Realtor.com fallback)' : '(via Zillow)'}`);
      } else {
        this.metrics.failedRequests++;
        failedCities++;
        console.log(`  ❌ ${cityConfig.name}: All methods failed`);
      }

      // Delay between cities
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    }

    this.metrics.totalListings = allListings.length;
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Store all listings
    if (allListings.length > 0) {
      try {
        await this.storeListings(allListings);
      } catch (error) {
        console.error('❌ Error storing listings:', error.message);
        this.metrics.errors.push(`Error storing listings: ${error.message}`);
      }
    }

    // Generate enhanced report
    this.generateEnhancedReport(duration, successfulCities, failedCities);

    return {
      success: failedCities === 0,
      totalListings: this.metrics.totalListings,
      duration,
      successfulCities,
      failedCities,
      fallbackActivations: this.metrics.fallbackActivations,
      errors: this.metrics.errors
    };
  }

  /**
   * Generate enhanced metrics report
   */
  generateEnhancedReport(duration, successfulCities, failedCities) {
    console.log(`\n🎯 ENHANCED HYBRID SCRAPER REPORT`);
    console.log(`===================================`);
    console.log(`⏱️ Duration: ${duration.toFixed(1)}s`);
    console.log(`📊 Success Rate: ${successfulCities}/${successfulCities + failedCities} cities`);
    console.log(`📈 Total Listings: ${this.metrics.totalListings}`);
    console.log(`🔄 Fallback Activations: ${this.metrics.fallbackActivations}`);
    console.log(`\n📊 Source Breakdown:`);
    console.log(`  🏠 Zillow (Decodo): ${this.metrics.decodoRequests} requests`);
    console.log(`  🏘️ Realtor.com: ${this.metrics.realtorRequests} requests`);
    console.log(`  📈 Realtor Listings: ${this.metrics.realtorListings}`);
    
    if (this.metrics.errors.length > 0) {
      console.log(`\n❌ Errors (${this.metrics.errors.length}):`);
      this.metrics.errors.slice(0, 5).forEach(error => console.log(`  - ${error}`));
      if (this.metrics.errors.length > 5) {
        console.log(`  ... and ${this.metrics.errors.length - 5} more errors`);
      }
    }

    const realtorPercentage = this.metrics.totalListings > 0 
      ? (this.metrics.realtorListings / this.metrics.totalListings * 100).toFixed(1)
      : 0;
    
    console.log(`\n🎯 Fallback Effectiveness: ${realtorPercentage}% of listings from Realtor.com`);
    
    if (this.metrics.fallbackActivations > 0) {
      console.log(`✅ Fallback system working - prevented ${this.metrics.fallbackActivations} city failures`);
    }
  }

  /**
   * Test both sources independently
   */
  async testSources(citiesToTest = ['Toronto', 'Vancouver']) {
    console.log('🧪 TESTING BOTH DATA SOURCES');
    console.log('=============================');

    const testCities = getAllCities().filter(c => citiesToTest.includes(c.name));
    
    // Test Zillow
    console.log('\n🏠 Testing Zillow (Decodo)...');
    const zillowResults = await this.scrapeCities('zillow', citiesToTest);
    
    // Test Realtor.com
    console.log('\n🏘️ Testing Realtor.com...');
    const realtorResults = await this.scrapeCities('realtor', citiesToTest);
    
    // Test Enhanced (both)
    console.log('\n🚀 Testing Enhanced (both sources)...');
    const enhancedResults = await this.scrapeCities('enhanced', citiesToTest);

    console.log('\n📊 COMPARISON RESULTS:');
    console.log('======================');
    console.log(`Zillow only: ${zillowResults.totalListings} listings`);
    console.log(`Realtor only: ${realtorResults.totalListings} listings`);
    console.log(`Enhanced (both): ${enhancedResults.totalListings} listings`);
    console.log(`Fallback activations: ${enhancedResults.fallbackActivations}`);
  }
}

export default EnhancedHybridScraper;
