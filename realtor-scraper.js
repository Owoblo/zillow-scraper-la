import DecodoAPI from './decodo-api.js';
import { createClient } from '@supabase/supabase-js';
import { getAllCities } from './config/regions.js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

class RealtorScraper {
  constructor() {
    this.decodo = new DecodoAPI();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalListings: 0,
      errors: []
    };
  }

  /**
   * Scrape a single city from Realtor.com
   */
  async scrapeCity(cityConfig) {
    try {
      console.log(`🏠 Scraping ${cityConfig.name} from Realtor.com...`);
      
      // Build Realtor.com search URL
      const searchUrl = this.buildRealtorUrl(cityConfig);
      console.log(`📍 Realtor URL: ${searchUrl}`);
      
      // Use Decodo to scrape Realtor.com
      const result = await this.decodo.scrape(searchUrl, {
        session_id: `realtor-${cityConfig.name.toLowerCase()}-${Date.now()}`,
        geo: "CA", // Target Canada
        device_type: "desktop"
      });

      if (!result.success) {
        throw new Error(`Realtor scraping failed: ${result.error}`);
      }

      // Handle async responses
      let html = result.html;
      if (result.isAsync) {
        const asyncResult = await this.decodo.pollAsyncResult(result.task_id);
        if (!asyncResult.success) {
          throw new Error(`Async polling failed: ${asyncResult.error}`);
        }
        html = asyncResult.html;
      }

      if (!html || html.length < 1000) {
        throw new Error('Invalid HTML response from Realtor.com');
      }

      // Parse listings from HTML
      const listings = this.parseRealtorListings(html, cityConfig.name);
      
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalListings += listings.length;
      
      console.log(`✅ Realtor.com: ${cityConfig.name} - ${listings.length} listings`);
      return listings;

    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.metrics.errors.push(`${cityConfig.name}: ${error.message}`);
      console.error(`❌ Realtor.com scraping failed for ${cityConfig.name}:`, error.message);
      return [];
    }
  }

  /**
   * Build Realtor.com search URL from city config
   */
  buildRealtorUrl(cityConfig) {
    const baseUrl = 'https://www.realtor.com/realestateandhomes-search';
    
    // Convert Zillow mapBounds to Realtor.com format
    const { north, south, east, west } = cityConfig.mapBounds;
    
    // Realtor.com uses different parameter format
    const params = new URLSearchParams({
      lat: ((north + south) / 2).toFixed(6),
      lng: ((east + west) / 2).toFixed(6),
      radius: '50', // 50km radius
      sort: 'relevance',
      status: 'for_sale'
    });

    return `${baseUrl}/${cityConfig.name.toLowerCase().replace(/\s+/g, '-')}-on?${params.toString()}`;
  }

  /**
   * Parse listings from Realtor.com HTML
   */
  parseRealtorListings(html, city) {
    try {
      // This is a simplified parser - Realtor.com has different HTML structure
      const listings = [];
      
      // Look for JSON data in script tags (common pattern)
      const scriptMatches = html.match(/<script[^>]*>.*?window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
      
      if (scriptMatches) {
        try {
          const jsonData = JSON.parse(scriptMatches[1]);
          const properties = this.extractPropertiesFromJson(jsonData, city);
          listings.push(...properties);
        } catch (jsonError) {
          console.warn(`⚠️ Failed to parse Realtor JSON: ${jsonError.message}`);
        }
      }

      // Fallback: try to parse HTML elements
      if (listings.length === 0) {
        const htmlListings = this.parseRealtorHtml(html, city);
        listings.push(...htmlListings);
      }

      return listings;

    } catch (error) {
      console.error(`❌ Error parsing Realtor listings:`, error.message);
      return [];
    }
  }

  /**
   * Extract properties from Realtor.com JSON data
   */
  extractPropertiesFromJson(jsonData, city) {
    const listings = [];
    
    try {
      // Navigate through Realtor.com's JSON structure
      const properties = jsonData?.searchResults?.home_search?.results || 
                       jsonData?.searchResults?.results ||
                       jsonData?.results || [];
      
      if (!Array.isArray(properties)) {
        return listings;
      }

      properties.forEach((property, index) => {
        try {
          const runId = `realtor-${Date.now()}`;
          const latObj = {
            latitude: property.location?.address?.coordinate?.lat || null,
            longitude: property.location?.address?.coordinate?.lon || null,
          };

          const listing = {
            zpid: property.property_id || `realtor-${city}-${index}-${Date.now()}`,
            lastrunid: runId,
            lastseenat: new Date().toISOString(),
            lastcity: city,
            lastpage: 1,
            isjustlisted: true,
            city: city,
            region: null,
            rawhomestatuscd: property.status || null,
            marketingstatussimplifiedcd: property.status || null,
            imgsrc: property.photo?.href || null,
            hasimage: property.photo ? true : false,
            detailurl: property.rdc_web_url || property.href || null,
            statustype: 'FOR_SALE',
            statustext: property.status || 'For Sale',
            countrycurrency: 'CAD',
            price: property.list_price || property.price || 'N/A',
            unformattedprice: property.list_price || property.price || null,
            address: property.location?.address?.line || 'N/A',
            addressstreet: property.location?.address?.line || null,
            addresszipcode: property.location?.address?.postal_code || null,
            isundisclosedaddress: false,
            addresscity: property.location?.address?.city || city,
            addressstate: property.location?.address?.state || 'ON',
            beds: property.description?.beds || null,
            baths: property.description?.baths || null,
            area: property.description?.sqft || property.description?.square_feet || null,
            latlong: JSON.stringify(latObj),
            hdpdata: property.hdp_data ? JSON.stringify(property.hdp_data) : null,
            carouselphotos: property.photos ? JSON.stringify(property.photos) : null,
            iszillowowned: false,
            issaved: false,
            isuserclaimingowner: false,
            isuserconfirmedclaim: false,
            shouldshowzestimateasprice: false,
            has3dmodel: property.virtual_tours ? true : false,
            hasvideo: property.virtual_tours ? true : false,
            ispropertyresultcdp: false,
            flexfieldtext: null,
            contenttype: 'realtor',
            pgapt: null,
            sgapt: null,
            list: null,
            info1string: property.description?.type || null,
            brokername: property.other_listings?.rdc?.office?.name || null,
            openhousedescription: property.open_houses?.[0]?.description || null,
            buildername: null,
            lotareastring: property.description?.lot_sqft ? `${property.description.lot_sqft} sqft` : null,
            providerlistingid: property.property_id || null,
            streetviewmetadataurl: null,
            streetviewurl: null,
            openhousestartdate: property.open_houses?.[0]?.start_time || null,
            openhouseenddate: property.open_houses?.[0]?.end_time || null,
            availability_date: property.availability_date || null,
            carousel_photos_composable: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          listings.push(listing);
        } catch (error) {
          console.warn(`⚠️ Error parsing Realtor property ${index}:`, error.message);
        }
      });

    } catch (error) {
      console.error(`❌ Error extracting Realtor properties:`, error.message);
    }

    return listings;
  }

  /**
   * Fallback HTML parsing for Realtor.com
   */
  parseRealtorHtml(html, city) {
    try {
      console.log(`📊 Parsing Realtor.com HTML: ${html.length} characters`);
      
      // Try to find listings in script tags (common pattern)
      const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/g);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          try {
            // Look for JSON data in script tags
            const jsonMatch = script.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              if (data && data.listings) {
                console.log(`✅ Found ${data.listings.length} listings in script tag`);
                return this.formatRealtorListings(data.listings, city);
              }
            }
          } catch (e) {
            // Continue to next script tag
          }
        }
      }

      // Try to find listings in data attributes
      const dataMatches = html.match(/data-listings="[^"]*"/g);
      if (dataMatches) {
        for (const match of dataMatches) {
          try {
            const jsonStr = match.replace('data-listings="', '').replace('"', '');
            const data = JSON.parse(decodeURIComponent(jsonStr));
            if (data && data.listings) {
              console.log(`✅ Found ${data.listings.length} listings in data attribute`);
              return this.formatRealtorListings(data.listings, city);
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }

      // Fallback: try to extract basic listing info from HTML structure
      const listingElements = html.match(/<div[^>]*class="[^"]*listing[^"]*"[^>]*>/g);
      if (listingElements) {
        console.log(`✅ Found ${listingElements.length} listing elements in HTML`);
        return this.parseRealtorListingsFromHTML(html, city);
      }

      console.log('⚠️ No listings found in Realtor.com HTML');
      return [];
    } catch (error) {
      console.error('❌ Error parsing Realtor HTML:', error.message);
      return [];
    }
  }

  /**
   * Parse listings from HTML structure
   */
  parseRealtorListingsFromHTML(html, city) {
    // Basic HTML parsing for Realtor.com structure
    const listings = [];
    
    // Look for common Realtor.com listing patterns
    const priceMatches = html.match(/\$[\d,]+/g);
    const addressMatches = html.match(/[A-Za-z0-9\s,]+(?:Street|Avenue|Road|Drive|Lane|Way|Boulevard|Crescent|Place|Court|Circle|Trail|Parkway|Highway|Route|Blvd|Ave|St|Rd|Dr|Ln|Way|Blvd|Cres|Pl|Ct|Cir|Trl|Pkwy|Hwy|Rte)/g);
    
    if (priceMatches && addressMatches) {
      const minLength = Math.min(priceMatches.length, addressMatches.length);
      for (let i = 0; i < minLength; i++) {
        listings.push({
          zpid: `realtor_${Date.now()}_${i}`,
          address: addressMatches[i].trim(),
          price: priceMatches[i],
          unformattedPrice: priceMatches[i],
          detailurl: '#',
          latlong: JSON.stringify({ lat: 0, lng: 0 }),
          bedrooms: 0,
          bathrooms: 0,
          squareFeet: 0,
          lotSize: 0,
          yearBuilt: 0,
          propertyType: 'Unknown',
          listingStatus: 'for_sale',
          daysOnMarket: 0,
          source: 'realtor.com',
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    return listings;
  }

  /**
   * Format Realtor.com listings to match database schema
   */
  formatRealtorListings(listings, city) {
    return listings.map((listing, index) => ({
      zpid: listing.id || `realtor_${city}_${Date.now()}_${index}`,
      address: listing.address || listing.street || 'Unknown Address',
      price: listing.price || listing.listPrice || '0',
      unformattedPrice: listing.price || listing.listPrice || '0',
      detailurl: listing.url || listing.detailUrl || '#',
      latlong: JSON.stringify({
        lat: listing.latitude || listing.lat || 0,
        lng: listing.longitude || listing.lng || 0
      }),
      bedrooms: listing.bedrooms || listing.beds || 0,
      bathrooms: listing.bathrooms || listing.baths || 0,
      squareFeet: listing.squareFeet || listing.sqft || 0,
      lotSize: listing.lotSize || 0,
      yearBuilt: listing.yearBuilt || 0,
      propertyType: listing.propertyType || 'Unknown',
      listingStatus: 'for_sale',
      daysOnMarket: listing.daysOnMarket || 0,
      source: 'realtor.com',
      scrapedAt: new Date().toISOString()
    }));
  }

  /**
   * Store listings in database
   */
  async storeListings(listings) {
    if (listings.length === 0) return;

    try {
      console.log(`💾 Storing ${listings.length} Realtor.com listings...`);
      
      const { error } = await this.supabase
        .from('current_listings')
        .upsert(listings, { 
          onConflict: 'zpid',
          ignoreDuplicates: false 
        });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Successfully stored ${listings.length} Realtor.com listings`);
    } catch (error) {
      console.error('❌ Error storing Realtor.com listings:', error.message);
      throw error;
    }
  }

  /**
   * Get scraping metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(1)
        : 0
    };
  }
}

export default RealtorScraper;
