import DecodoAPI from './decodo-api.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Simple Decodo integration for testing
 * This will work with sites that don't require JavaScript rendering
 */
class DecodoIntegration {
  constructor() {
    this.decodo = new DecodoAPI();
  }

  /**
   * Test if Decodo can scrape a specific URL
   * @param {string} url - URL to test
   * @returns {Promise<Object>} - Test result
   */
  async testUrl(url) {
    console.log(`🧪 Testing URL: ${url}`);
    
    try {
      const result = await this.decodo.scrape(url);
      
      if (result.success) {
        if (result.isAsync) {
          console.log(`⚠️ URL requires async processing (task_id: ${result.task_id})`);
          console.log(`Status: ${result.status}`);
          
          if (result.status === 'failed') {
            console.log(`❌ URL is blocked or requires Advanced plan features`);
            return {
              success: false,
              reason: 'blocked_or_advanced_required',
              task_id: result.task_id,
              status: result.status
            };
          }
          
          return {
            success: false,
            reason: 'async_processing_required',
            task_id: result.task_id,
            status: result.status
          };
        } else {
          console.log(`✅ URL scraped successfully (${result.html?.length || 0} characters)`);
          return {
            success: true,
            html: result.html,
            length: result.html?.length || 0
          };
        }
      } else {
        console.log(`❌ URL scraping failed: ${result.error}`);
        return {
          success: false,
          reason: 'scraping_failed',
          error: result.error
        };
      }
      
    } catch (error) {
      console.log(`❌ URL test error: ${error.message}`);
      return {
        success: false,
        reason: 'test_error',
        error: error.message
      };
    }
  }

  /**
   * Test multiple URLs to see which ones work
   * @param {Array<string>} urls - URLs to test
   * @returns {Promise<Object>} - Test results
   */
  async testMultipleUrls(urls) {
    console.log(`🧪 Testing ${urls.length} URLs...`);
    
    const results = {
      working: [],
      blocked: [],
      async_required: [],
      failed: []
    };
    
    for (const url of urls) {
      const result = await this.testUrl(url);
      
      if (result.success) {
        results.working.push({ url, length: result.length });
      } else if (result.reason === 'blocked_or_advanced_required') {
        results.blocked.push({ url, task_id: result.task_id, status: result.status });
      } else if (result.reason === 'async_processing_required') {
        results.async_required.push({ url, task_id: result.task_id, status: result.status });
      } else {
        results.failed.push({ url, error: result.error });
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}

// Test function
async function runTests() {
  console.log('🚀 Decodo Integration Tests');
  console.log('============================');
  
  const integration = new DecodoIntegration();
  
  // Test URLs
  const testUrls = [
    'https://ip.decodo.com',
    'https://httpbin.org/html',
    'https://example.com',
    'https://www.zillow.com/homes/for_sale/toronto-792680_rb/',
    'https://www.realtor.ca/',
    'https://www.remax.ca/'
  ];
  
  const results = await integration.testMultipleUrls(testUrls);
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Working URLs: ${results.working.length}`);
  results.working.forEach(r => console.log(`   - ${r.url} (${r.length} chars)`));
  
  console.log(`❌ Blocked URLs: ${results.blocked.length}`);
  results.blocked.forEach(r => console.log(`   - ${r.url} (${r.status})`));
  
  console.log(`🔄 Async Required: ${results.async_required.length}`);
  results.async_required.forEach(r => console.log(`   - ${r.url} (${r.status})`));
  
  console.log(`💥 Failed URLs: ${results.failed.length}`);
  results.failed.forEach(r => console.log(`   - ${r.url} (${r.error})`));
  
  console.log('\n💡 Recommendations:');
  if (results.blocked.length > 0) {
    console.log('   - Consider upgrading to Advanced plan for blocked sites');
  }
  if (results.async_required.length > 0) {
    console.log('   - Async processing needed - check Decodo documentation for status endpoints');
  }
  if (results.working.length > 0) {
    console.log('   - Core plan works for simple sites');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export default DecodoIntegration;
