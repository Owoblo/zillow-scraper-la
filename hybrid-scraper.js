import { createClient } from '@supabase/supabase-js';
import { getAllCities } from './config/regions.js';
import DecodoZillowScraper from './decodo-scraper.js';
import { fetchSearchPage } from './zillow.js';
import dotenv from 'dotenv';

dotenv.config();

class HybridZillowScraper {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    this.decodoScraper = new DecodoZillowScraper();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      decodoRequests: 0,
      currentRequests: 0,
      totalListings: 0
    };
  }

  /**
   * Main scraping method - can use either current system or Decodo Advanced
   * @param {string} method - 'current', 'decodo', or 'hybrid'
   * @param {Array} cities - Array of city names to scrape
   * @returns {Promise<Object>} - Scraping results
   */
  async scrapeCities(method = 'hybrid', cities = null) {
    console.log(`🚀 Starting Hybrid Zillow Scraper (Method: ${method})`);
    console.log('================================================');
    
    const startTime = Date.now();
    
    try {
      // Get cities to scrape
      const citiesToScrape = cities || this.getDefaultCities();
      console.log(`📍 Scraping ${citiesToScrape.length} cities: ${citiesToScrape.join(', ')}`);
      
      let allListings = [];
      const results = {
        success: true,
        method: method,
        cities: [],
        totalListings: 0,
        errors: [],
        metrics: this.metrics
      };
      
      // Process each city
      for (const cityName of citiesToScrape) {
        console.log(`\n🏙️ Processing ${cityName}...`);
        
        try {
          let cityListings = [];
          
          if (method === 'current') {
            cityListings = await this.scrapeCityCurrent(cityName);
          } else if (method === 'decodo') {
            cityListings = await this.scrapeCityDecodo(cityName);
          } else if (method === 'hybrid') {
            // Try Decodo first, fallback to current if it fails
            try {
              cityListings = await this.scrapeCityDecodo(cityName);
              console.log(`✅ ${cityName}: ${cityListings.length} listings (Decodo)`);
            } catch (decodoError) {
              console.log(`⚠️ ${cityName}: Decodo failed, trying current system...`);
              cityListings = await this.scrapeCityCurrent(cityName);
              console.log(`✅ ${cityName}: ${cityListings.length} listings (Current)`);
            }
          }
          
          allListings.push(...cityListings);
          results.cities.push({
            name: cityName,
            listings: cityListings.length,
            success: true
          });
          
          // Add delay between cities
          await this.delay(2000 + Math.random() * 3000);
          
        } catch (error) {
          console.error(`❌ Error processing ${cityName}:`, error.message);
          results.errors.push({
            city: cityName,
            error: error.message
          });
          results.cities.push({
            name: cityName,
            listings: 0,
            success: false,
            error: error.message
          });
        }
      }
      
      // Store results in database
      if (allListings.length > 0) {
        await this.storeListings(allListings);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      results.totalListings = allListings.length;
      results.duration = duration;
      results.metrics = this.metrics;
      
      console.log(`\n✅ Scraping completed in ${duration.toFixed(1)}s`);
      console.log(`📊 Total listings: ${allListings.length}`);
      console.log(`📊 Decodo requests: ${this.metrics.decodoRequests}`);
      console.log(`📊 Current requests: ${this.metrics.currentRequests}`);
      console.log(`📊 Success rate: ${this.metrics.successfulRequests}/${this.metrics.totalRequests}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Scraping failed:', error.message);
      return {
        success: false,
        method: method,
        error: error.message,
        metrics: this.metrics
      };
    }
  }

  /**
   * Scrape city using current system (zillow.js)
   */
  async scrapeCityCurrent(cityName) {
    this.metrics.currentRequests++;
    this.metrics.totalRequests++;
    
    try {
      const cityConfig = this.getCityConfig(cityName);
      if (!cityConfig) {
        throw new Error(`City configuration not found for ${cityName}`);
      }
      
      const allListings = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages && page <= 20) {
        const pageListings = await fetchSearchPage(cityConfig, page);
        
        if (pageListings.length === 0) {
          hasMorePages = false;
          break;
        }
        
        allListings.push(...pageListings);
        page++;
        
        // Add delay between pages
        await this.delay(1000 + Math.random() * 2000);
      }
      
      this.metrics.successfulRequests++;
      this.metrics.totalListings += allListings.length;
      
      return allListings;
      
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Scrape city using Decodo Advanced
   */
  async scrapeCityDecodo(cityName) {
    this.metrics.decodoRequests++;
    this.metrics.totalRequests++;
    
    try {
      const cityConfig = this.getCityConfig(cityName);
      if (!cityConfig) {
        throw new Error(`City configuration not found for ${cityName}`);
      }
      
      const allListings = await this.decodoScraper.scrapeCity(cityConfig);
      
      this.metrics.successfulRequests++;
      this.metrics.totalListings += allListings.length;
      
      return allListings;
      
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Get city configuration
   */
  getCityConfig(cityName) {
    const allCities = getAllCities();
    return allCities.find(city => 
      city.name.toLowerCase() === cityName.toLowerCase()
    ) || null;
  }

  /**
   * Get default cities for testing
   */
  getDefaultCities() {
    return ['Toronto', 'Windsor']; // Start with just 2 cities for testing
  }

  /**
   * Store listings in database
   */
  async storeListings(listings) {
    try {
      console.log(`💾 Storing ${listings.length} listings in database...`);
      
      const { error } = await this.supabase
        .from('current_listings')
        .upsert(listings, { 
          onConflict: 'zpid',
          ignoreDuplicates: false 
        });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Successfully stored ${listings.length} listings`);
      
    } catch (error) {
      console.error('❌ Error storing listings:', error.message);
      throw error;
    }
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default HybridZillowScraper;
