#!/usr/bin/env node

// Enterprise Worker System for Queue Processing
import { createClient } from "@supabase/supabase-js";
import { getSmartProxyAgent } from "./proxies.js";
import { mapItemToRow, upsertListingsWithValidation, validateListingData } from "./zillow.js";
import fetch from "node-fetch";

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

// Worker configuration
const WORKER_CONFIG = {
  MAX_PAGES_PER_CITY: 20,
  MAX_RETRIES: 3,
  RETRY_DELAYS: [2000, 5000, 10000], // Progressive delays
  CONCURRENT_REQUESTS: 3,
  REQUEST_TIMEOUT: 30000,
  BATCH_SIZE: 50
};

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced fetch with retry logic and anti-detection
async function advancedFetch(url, options = {}, maxRetries = WORKER_CONFIG.MAX_RETRIES) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        agent: getSmartProxyAgent(),
        timeout: WORKER_CONFIG.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
          'Origin': 'https://www.zillow.com',
          'Referer': 'https://www.zillow.com/homes/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
      
    } catch (error) {
      attempt++;
      console.warn(`⚠️ Fetch attempt ${attempt} failed for ${url}: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = WORKER_CONFIG.RETRY_DELAYS[attempt - 1] || 10000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

// Process a single city with enhanced error handling
export async function processCityWithQueue(job) {
  const { city, region, mapBounds, regionId, priority } = job.data;
  const startTime = Date.now();
  const runId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🏙️ Worker processing ${city} (${region}) - Priority: ${priority}`);
  
  try {
    const allListings = [];
    let page = 1;
    let hasMorePages = true;
    let consecutiveErrors = 0;
    let totalPages = 0;

    // Process pages with enhanced error handling
    while (hasMorePages && page <= WORKER_CONFIG.MAX_PAGES_PER_CITY) {
      try {
        const searchQueryState = {
          pagination: { currentPage: page },
          isMapVisible: true,
          mapBounds: mapBounds,
          regionSelection: [{ regionId: regionId, regionType: 6 }],
          filterState: {
            sortSelection: { value: "globalrelevanceex" },
            isAllHomes: { value: true },
          },
          isEntirePlaceForRent: true,
          isRoomForRent: false,
          isListVisible: true,
        };

        const response = await advancedFetch(
          "https://www.zillow.com/async-create-search-page-state",
          {
            method: "PUT",
            body: JSON.stringify({
              searchQueryState,
              wants: { cat1: ["listResults", "mapResults"], cat2: ["total"] },
            }),
          }
        );

        const data = await response.json();
        
        if (data && data.cat1 && data.cat1.searchResults && data.cat1.searchResults.listResults) {
          const listings = data.cat1.searchResults.listResults;
          
          if (listings.length > 0) {
            // Add metadata to each listing
            listings.forEach(listing => {
              listing.__meta = {
                areaName: city,
                page: page,
                runId: runId,
                regionName: region
              };
            });
            
            allListings.push(...listings);
            totalPages = page;
            consecutiveErrors = 0;
            
            console.log(`📄 ${city} page ${page}: ${listings.length} listings`);
            
            // Random delay between pages
            const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
            await sleep(delay);
            
          } else {
            console.log(`📄 ${city} page ${page}: No more listings`);
            hasMorePages = false;
          }
        } else {
          console.warn(`⚠️ ${city} page ${page}: Invalid response structure`);
          consecutiveErrors++;
          
          if (consecutiveErrors >= 3) {
            console.log(`❌ ${city}: Too many consecutive errors, stopping`);
            hasMorePages = false;
          }
        }
        
        page++;
        
      } catch (error) {
        consecutiveErrors++;
        console.error(`❌ ${city} page ${page} error:`, error.message);
        
        if (consecutiveErrors >= 3) {
          console.log(`❌ ${city}: Too many consecutive errors, stopping`);
          hasMorePages = false;
        } else {
          // Exponential backoff
          const delay = Math.pow(2, consecutiveErrors) * 1000;
          await sleep(delay);
        }
      }
    }

    if (allListings.length === 0) {
      console.log(`❌ ${city}: No listings found`);
      return {
        success: false,
        city,
        listings: 0,
        error: 'No listings found',
        duration: Date.now() - startTime
      };
    }

    // Process and validate listings
    console.log(`🔄 ${city}: Processing ${allListings.length} listings...`);
    
    const mappedRows = allListings
      .map(item => mapItemToRow(item, city, item.__meta?.page || 1, runId, region))
      .filter(row => row !== null);

    // Validate listings
    const validatedRows = mappedRows.filter(listing => {
      if (!validateListingData(listing)) {
        console.warn(`⚠️ Skipping invalid listing: ${listing.zpid}`);
        return false;
      }
      return true;
    });

    if (validatedRows.length === 0) {
      console.log(`❌ ${city}: No valid listings after validation`);
      return {
        success: false,
        city,
        listings: 0,
        error: 'No valid listings after validation',
        duration: Date.now() - startTime
      };
    }

    // Store in database with batch processing
    console.log(`💾 ${city}: Storing ${validatedRows.length} listings in database...`);
    
    // Process in batches to avoid memory issues
    const batches = [];
    for (let i = 0; i < validatedRows.length; i += WORKER_CONFIG.BATCH_SIZE) {
      batches.push(validatedRows.slice(i, i + WORKER_CONFIG.BATCH_SIZE));
    }

    for (const batch of batches) {
      await upsertListingsWithValidation(batch, 'current_listings');
      await sleep(100); // Small delay between batches
    }

    const duration = Date.now() - startTime;
    console.log(`✅ ${city}: Successfully processed ${validatedRows.length} listings in ${duration}ms`);
    
    return {
      success: true,
      city,
      region,
      listings: validatedRows.length,
      totalPages,
      duration,
      runId
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${city}: Worker error:`, error.message);
    
    return {
      success: false,
      city,
      region,
      listings: 0,
      error: error.message,
      duration
    };
  }
}

// Worker health check
export async function workerHealthCheck() {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('current_listings')
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    
    // Test proxy connection
    const response = await fetch('https://httpbin.org/ip', {
      agent: getSmartProxyAgent(),
      timeout: 10000
    });
    
    if (!response.ok) throw new Error('Proxy test failed');
    
    return {
      status: 'healthy',
      database: 'connected',
      proxy: 'working',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Worker metrics
export class WorkerMetrics {
  constructor() {
    this.metrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalListings: 0,
      averageProcessingTime: 0,
      startTime: Date.now(),
      lastJobTime: null
    };
  }

  updateMetrics(jobResult) {
    this.metrics.totalJobs++;
    this.metrics.lastJobTime = Date.now();
    
    if (jobResult.success) {
      this.metrics.successfulJobs++;
      this.metrics.totalListings += jobResult.listings;
    } else {
      this.metrics.failedJobs++;
    }
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalJobs - 1) + jobResult.duration;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalJobs;
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      ...this.metrics,
      uptime: Math.floor(uptime / 1000),
      successRate: this.metrics.totalJobs > 0 ? 
        (this.metrics.successfulJobs / this.metrics.totalJobs * 100).toFixed(2) : 0,
      listingsPerHour: this.metrics.totalListings / (uptime / (1000 * 60 * 60))
    };
  }
}

export const workerMetrics = new WorkerMetrics();
