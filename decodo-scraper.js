import DecodoAPI from './decodo-api.js';
import { parse } from 'node-html-parser';
import { getAllCities, getCitiesForRegion } from './config/regions.js';

class DecodoZillowScraper {
  constructor() {
    this.decodo = new DecodoAPI();
    this.results = [];
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalListings: 0
    };
  }

  /**
   * Get city configuration from regions
   * @param {string} cityName - City name
   * @returns {Object|null} - City configuration or null if not found
   */
  getCityConfig(cityName) {
    const allCities = getAllCities();
    return allCities.find(city => 
      city.name.toLowerCase() === cityName.toLowerCase()
    ) || null;
  }

  /**
   * Scrape a single Zillow search page
   * @param {string} city - City name
   * @param {Object} cityConfig - City configuration
   * @param {number} page - Page number
   * @returns {Promise<Array>} - Listings from the page
   */
  async scrapeCityPage(city, cityConfig, page = 1) {
    try {
      console.log(`📍 Scraping ${city} - Page ${page}`);
      
      // Use hybrid approach: direct fetch to async endpoint
      const listings = await this.scrapeCityAsync(cityConfig, city, page);
      
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      
      console.log(`✅ ${city} page ${page}: ${listings.length} listings found`);
      return listings;
      
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      console.error(`❌ Error scraping ${city} page ${page}:`, error.message);
      return [];
    }
  }

  async scrapeCityAsync(cityConfig, city, page = 1) {
    try {
      // Build search query state (same as zillow.js)
      const searchQueryState = {
        pagination: { currentPage: page },
        isMapVisible: true,
        mapBounds: cityConfig.mapBounds,
        regionSelection: [{ regionId: cityConfig.regionId, regionType: 6 }],
        filterState: {
          sortSelection: { value: "globalrelevanceex" },
          isAllHomes: { value: true },
        },
        isEntirePlaceForRent: true,
        isRoomForRent: false,
        isListVisible: true,
      };
      
      // Use direct fetch to async endpoint (hybrid approach)
      const response = await fetch("https://www.zillow.com/async-create-search-page-state", {
        method: "PUT",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Content-Type": "application/json",
          "Origin": "https://www.zillow.com",
          "Referer": "https://www.zillow.com/homes/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        body: JSON.stringify({
          searchQueryState,
          wants: { cat1: ["listResults", "mapResults"], cat2: ["total"] },
        }),
      });
      
      const text = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (text.trim().startsWith("<")) {
        throw new Error("Got HTML instead of JSON");
      }
      
      const json = JSON.parse(text);
      const listings = json?.cat1?.searchResults?.listResults ?? [];
      
      if (!Array.isArray(listings)) {
        throw new Error("Invalid listings format");
      }
      
      // Convert to our format (matching exact database schema)
      return listings.map((listing, index) => {
        const runId = `decodo-${Date.now()}`;
        const latObj = {
          latitude: listing.latLong?.latitude || null,
          longitude: listing.latLong?.longitude || null,
        };
        
        return {
          // Primary key (required for upsert)
          zpid: listing.zpid || `${city}-${index}-${Date.now()}`,
          
          // Run tracking
          lastrunid: runId,
          lastseenat: new Date().toISOString(),
          lastcity: city,
          lastpage: 1, // Decodo gets all pages at once
          isjustlisted: true, // Assume new listings
          
          // Regional identification
          city: city,
          region: null,
          
          // Status fields
          rawhomestatuscd: listing.rawHomeStatusCd || null,
          marketingstatussimplifiedcd: listing.marketingStatusSimplifiedCd || null,
          imgsrc: listing.imgSrc || null,
          hasimage: listing.hasImage || null,
          detailurl: listing.detailUrl || null,
          statustype: listing.statusType || 'UNKNOWN',
          statustext: listing.statusText || null,
          countrycurrency: listing.countryCurrency || 'CAD',
          
          // Price fields
          price: listing.price || 'N/A',
          unformattedprice: listing.unformattedPrice || null,
          
          // Address fields
          address: listing.address || 'N/A',
          addressstreet: listing.addressStreet || null,
          addresszipcode: listing.addressZipcode || null,
          isundisclosedaddress: listing.isUndisclosedAddress || null,
          addresscity: listing.addressCity || null,
          addressstate: listing.addressState || null,
          
          // Numeric fields
          beds: listing.beds || null,
          baths: listing.baths || null,
          area: listing.hdpData?.homeInfo?.lotAreaValue || null,
          
          // JSONB fields
          latlong: JSON.stringify(latObj),
          hdpdata: listing.hdpData ? JSON.stringify(listing.hdpData) : null,
          carouselphotos: listing.carouselPhotos ? JSON.stringify(listing.carouselPhotos) : null,
          
          // Boolean fields
          iszillowowned: listing.isZillowOwned || null,
          issaved: listing.isSaved || null,
          isuserclaimingowner: listing.isUserClaimingOwner || null,
          isuserconfirmedclaim: listing.isUserConfirmedClaim || null,
          shouldshowzestimateasprice: listing.shouldShowZestimateAsPrice || null,
          has3dmodel: listing.has3dModel || null,
          hasvideo: listing.hasVideo || null,
          ispropertyresultcdp: listing.isPropertyResultCdp || null,
          
          // Additional fields
          flexfieldtext: listing.flexFieldText || null,
          contenttype: listing.contentType || null,
          pgapt: listing.pgApt || null,
          sgapt: listing.sgApt || null,
          list: listing.list || null,
          info1string: listing.info1String || null,
          brokername: listing.brokerName || null,
          openhousedescription: listing.openHouseDescription || null,
          buildername: listing.builderName || null,
          lotareastring: listing.lotAreaString || null,
          providerlistingid: listing.providerListingId || null,
          streetviewmetadataurl: listing.streetViewMetadataUrl || null,
          streetviewurl: listing.streetViewUrl || null,
          openhousestartdate: listing.openHouseStartDate || null,
          openhouseenddate: listing.openHouseEndDate || null,
          availability_date: listing.availabilityDate || null,
          carousel_photos_composable: listing.carouselPhotosComposable || null,
          
          // Timestamps (let database handle these)
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      
    } catch (error) {
      console.error(`❌ Error in async scraping for ${city}:`, error.message);
      return [];
    }
  }

  /**
   * Build Zillow search URL
   * @param {string} city - City name
   * @param {Object} cityConfig - City configuration
   * @param {number} page - Page number
   * @returns {string} - Zillow URL
   */
  buildZillowUrl(city, cityConfig, page = 1) {
    const { mapBounds, regionId } = cityConfig;
    const { north, south, east, west } = mapBounds;
    
    const baseUrl = 'https://www.zillow.com/homes/for_sale/';
    const params = new URLSearchParams({
      'searchQueryState': JSON.stringify({
        "pagination": {
          "currentPage": page
        },
        "mapBounds": {
          "north": north,
          "south": south,
          "east": east,
          "west": west
        },
        "regionSelection": [{
          "regionId": regionId,
          "regionType": 6
        }],
        "isMapVisible": true,
        "filterState": {
          "sort": {
            "value": "globalrelevanceex"
          }
        },
        "isListVisible": true
      }),
      'wants': JSON.stringify({
        "cat1": ["mapResults"],
        "cat2": ["listResults"]
      }),
      'requestId': Math.random().toString(36).substring(7)
    });
    
    return `${baseUrl}${city.toLowerCase().replace(/\s+/g, '-')}-${regionId}_rb/?${params.toString()}`;
  }

  /**
   * Parse Zillow listings from HTML
   * @param {string} html - HTML content
   * @param {string} city - City name
   * @returns {Array} - Parsed listings
   */
  parseZillowListings(html, city) {
    try {
      console.log(`🔍 Parsing HTML for ${city} (${html?.length || 0} characters)`);
      
      if (!html) {
        console.warn(`⚠️ No HTML content received for ${city}`);
        return [];
      }
      
      const root = parse(html);
      const listings = [];
      
      // Find listing containers - Zillow uses different selectors
      let listingElements = root.querySelectorAll('[data-testid="property-card"]');
      
      // If no property cards found, try alternative selectors
      if (listingElements.length === 0) {
        listingElements = root.querySelectorAll('.ListItem-c11n-8-109-3__sc-10e22w8-0');
      }
      
      // If still no results, try searching for listing data in script tags
      if (listingElements.length === 0) {
        const scriptTags = root.querySelectorAll('script');
        for (const script of scriptTags) {
          const content = script.textContent || '';
          if (content.includes('"listResults"') && content.includes('"zpid"')) {
            console.log(`🔍 Found listing data in script tag`);
            // Parse JSON data from script
            try {
              const jsonMatch = content.match(/"listResults":\s*(\[.*?\])/);
              if (jsonMatch) {
                const listingsData = JSON.parse(jsonMatch[1]);
                console.log(`🔍 Found ${listingsData.length} listings in JSON data`);
                return this.parseJsonListings(listingsData, city);
              }
            } catch (error) {
              console.warn(`⚠️ Error parsing JSON data:`, error.message);
            }
          }
        }
      }
      
      console.log(`🔍 Found ${listingElements?.length || 0} property cards`);
      
      listingElements.forEach((element, index) => {
        try {
          const listing = this.extractListingData(element, city, index);
          if (listing) {
            listings.push(listing);
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing listing ${index} in ${city}:`, error.message);
        }
      });
      
      return listings;
      
    } catch (error) {
      console.error(`❌ Error parsing HTML for ${city}:`, error.message);
      return [];
    }
  }

  /**
   * Parse listings from JSON data
   * @param {Array} listingsData - Array of listing objects
   * @param {string} city - City name
   * @returns {Array} - Parsed listings
   */
  parseJsonListings(listingsData, city) {
    const listings = [];
    
    listingsData.forEach((listing, index) => {
      try {
        const runId = `decodo-${Date.now()}`;
        const latObj = {
          latitude: listing.latLong?.latitude || null,
          longitude: listing.latLong?.longitude || null,
        };
        
        const parsedListing = {
          zpid: listing.zpid || `${city}-${index}-${Date.now()}`,
          lastrunid: runId,
          lastseenat: new Date().toISOString(),
          lastcity: city,
          lastpage: 1,
          isjustlisted: true,
          city: city,
          region: null,
          rawhomestatuscd: listing.rawHomeStatusCd || null,
          marketingstatussimplifiedcd: listing.marketingStatusSimplifiedCd || null,
          imgsrc: listing.imgSrc || null,
          hasimage: listing.hasImage || null,
          detailurl: listing.detailUrl || null,
          statustype: listing.statusType || 'UNKNOWN',
          statustext: listing.statusText || null,
          countrycurrency: listing.countryCurrency || 'CAD',
          price: listing.price || 'N/A',
          unformattedprice: listing.unformattedPrice || null,
          address: listing.address || 'N/A',
          addressstreet: listing.addressStreet || null,
          addresszipcode: listing.addressZipcode || null,
          isundisclosedaddress: listing.isUndisclosedAddress || null,
          addresscity: listing.addressCity || null,
          addressstate: listing.addressState || null,
          beds: listing.beds || null,
          baths: listing.baths || null,
          area: listing.hdpData?.homeInfo?.lotAreaValue || null,
          latlong: JSON.stringify(latObj),
          hdpdata: listing.hdpData ? JSON.stringify(listing.hdpData) : null,
          carouselphotos: listing.carouselPhotos ? JSON.stringify(listing.carouselPhotos) : null,
          iszillowowned: listing.isZillowOwned || null,
          issaved: listing.isSaved || null,
          isuserclaimingowner: listing.isUserClaimingOwner || null,
          isuserconfirmedclaim: listing.isUserConfirmedClaim || null,
          shouldshowzestimateasprice: listing.shouldShowZestimateAsPrice || null,
          has3dmodel: listing.has3dModel || null,
          hasvideo: listing.hasVideo || null,
          ispropertyresultcdp: listing.isPropertyResultCdp || null,
          flexfieldtext: listing.flexFieldText || null,
          contenttype: listing.contentType || null,
          pgapt: listing.pgApt || null,
          sgapt: listing.sgApt || null,
          list: listing.list || null,
          info1string: listing.info1String || null,
          brokername: listing.brokerName || null,
          openhousedescription: listing.openHouseDescription || null,
          buildername: listing.builderName || null,
          lotareastring: listing.lotAreaString || null,
          providerlistingid: listing.providerListingId || null,
          streetviewmetadataurl: listing.streetViewMetadataUrl || null,
          streetviewurl: listing.streetViewUrl || null,
          openhousestartdate: listing.openHouseStartDate || null,
          openhouseenddate: listing.openHouseEndDate || null,
          availability_date: listing.availabilityDate || null,
          carousel_photos_composable: listing.carouselPhotosComposable || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        listings.push(parsedListing);
      } catch (error) {
        console.warn(`⚠️ Error parsing listing ${index}:`, error.message);
      }
    });
    
    return listings;
  }

  /**
   * Extract listing data from HTML element
   * @param {Object} element - HTML element
   * @param {string} city - City name
   * @param {number} index - Listing index
   * @returns {Object|null} - Listing data
   */
  extractListingData(element, city, index) {
    try {
      // Extract basic listing information
      const priceElement = element.querySelector('[data-testid="property-card-price"]');
      const addressElement = element.querySelector('[data-testid="property-card-addr"]');
      const linkElement = element.querySelector('a[href*="/homedetails/"]');
      
      if (!priceElement || !addressElement) {
        return null;
      }
      
      const price = priceElement.textContent?.trim();
      const address = addressElement.textContent?.trim();
      const detailUrl = linkElement?.getAttribute('href');
      
      // Extract additional details
      const bedsElement = element.querySelector('[data-testid="property-card-beds"]');
      const bathsElement = element.querySelector('[data-testid="property-card-baths"]');
      const sqftElement = element.querySelector('[data-testid="property-card-sqft"]');
      
      const beds = bedsElement?.textContent?.trim();
      const baths = bathsElement?.textContent?.trim();
      const sqft = sqftElement?.textContent?.trim();
      
      const runId = `decodo-${Date.now()}`;
      const latObj = { latitude: null, longitude: null };
      
      return {
        zpid: `${city}-${index}-${Date.now()}`,
        lastrunid: runId,
        lastseenat: new Date().toISOString(),
        lastcity: city,
        lastpage: 1,
        isjustlisted: true,
        city: city,
        region: null,
        rawhomestatuscd: null,
        marketingstatussimplifiedcd: null,
        imgsrc: null,
        hasimage: null,
        detailurl: detailUrl ? `https://www.zillow.com${detailUrl}` : null,
        statustype: 'UNKNOWN',
        statustext: null,
        countrycurrency: 'CAD',
        price: price,
        unformattedprice: null,
        address: address,
        addressstreet: null,
        addresszipcode: null,
        isundisclosedaddress: null,
        addresscity: null,
        addressstate: null,
        beds: beds,
        baths: baths,
        area: sqft,
        latlong: JSON.stringify(latObj),
        hdpdata: null,
        carouselphotos: null,
        iszillowowned: null,
        issaved: null,
        isuserclaimingowner: null,
        isuserconfirmedclaim: null,
        shouldshowzestimateasprice: null,
        has3dmodel: null,
        hasvideo: null,
        ispropertyresultcdp: null,
        flexfieldtext: null,
        contenttype: null,
        pgapt: null,
        sgapt: null,
        list: null,
        info1string: null,
        brokername: null,
        openhousedescription: null,
        buildername: null,
        lotareastring: null,
        providerlistingid: null,
        streetviewmetadataurl: null,
        streetviewurl: null,
        openhousestartdate: null,
        openhouseenddate: null,
        availability_date: null,
        carousel_photos_composable: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn(`⚠️ Error extracting listing data:`, error.message);
      return null;
    }
  }

  /**
   * Scrape all cities in a region
   * @param {string} regionKey - Region key
   * @returns {Promise<Array>} - All listings from the region
   */
  async scrapeRegion(regionKey) {
    console.log(`🏙️ Scraping region: ${regionKey}`);
    
    const cities = getCitiesForRegion(regionKey);
    const allListings = [];
    
    for (const city of cities) {
      try {
        console.log(`📍 Processing ${city.name}...`);
        
        const cityListings = await this.scrapeCity(city);
        allListings.push(...cityListings);
        
        // Add delay between cities
        await this.delay(2000 + Math.random() * 3000);
        
      } catch (error) {
        console.error(`❌ Error processing ${city.name}:`, error.message);
      }
    }
    
    console.log(`✅ Region ${regionKey}: ${allListings.length} total listings`);
    return allListings;
  }

  /**
   * Scrape a single city (all pages)
   * @param {Object} city - City configuration
   * @returns {Promise<Array>} - All listings from the city
   */
  async scrapeCity(city) {
    const allListings = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages && page <= 20) { // Limit to 20 pages
      const pageListings = await this.scrapeCityPage(city.name, city, page);
      
      if (pageListings.length === 0) {
        hasMorePages = false;
        break;
      }
      
      allListings.push(...pageListings);
      page++;
      
      // Add delay between pages
      await this.delay(1000 + Math.random() * 2000);
    }
    
    console.log(`✅ ${city.name}: ${allListings.length} listings from ${page - 1} pages`);
    return allListings;
  }

  /**
   * Test the scraper with a single city
   * @param {string} cityName - City name to test
   * @returns {Promise<Object>} - Test results
   */
  async testScraper(cityName = 'Toronto') {
    console.log(`🧪 Testing Decodo scraper with ${cityName}...`);
    
    try {
      // Test API connection first
      const connectionTest = await this.decodo.testConnection();
      if (!connectionTest.success) {
        return { success: false, error: 'API connection failed', details: connectionTest };
      }
      
      // Find the city configuration
      const allCities = getAllCities();
      const city = allCities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
      
      if (!city) {
        return { success: false, error: `City ${cityName} not found in configuration` };
      }
      
      // Scrape the city
      const listings = await this.scrapeCity(city);
      
      return {
        success: true,
        city: cityName,
        listings: listings,
        count: listings.length,
        metrics: this.metrics
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metrics: this.metrics
      };
    }
  }

  /**
   * Get scraper metrics
   * @returns {Object} - Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Add delay between requests
   * @param {number} ms - Milliseconds to delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DecodoZillowScraper;
