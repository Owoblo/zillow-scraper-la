import fetch from 'node-fetch';

class DecodoAPI {
  constructor() {
    this.apiKey = process.env.DECODO_API_KEY;
    this.baseUrl = 'https://scraper-api.decodo.com/v2';
    
    if (!this.apiKey) {
      throw new Error('DECODO_API_KEY environment variable is required');
    }
  }

  /**
   * Scrape a single URL using Decodo Core API
   * @param {string} url - The URL to scrape
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Scraped content
   */
  async scrape(url, options = {}) {
    const payload = {
      url: url,
      headless: "html", // Advanced plan supports headless mode
      geo: "CA", // Target Canada
      device_type: "desktop",
      ...options
    };

    try {
      console.log(`🔄 Decodo API: Scraping ${url}`);
      
      // Try synchronous endpoint first, fallback to async if needed
      const endpoint = `${this.baseUrl}/scrape`;
      console.log(`📍 Using endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Decodo API Error Response:`, errorText);
        throw new Error(`Decodo API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      console.log(`✅ Decodo API: Successfully scraped ${url}`);
      console.log(`📊 Response structure:`, Object.keys(data));
      
      // Check if this is an asynchronous response
      if (data.task_id || data.id) {
        const taskId = data.task_id || data.id;
        console.log(`🔄 Asynchronous request detected, task_id: ${taskId}`);
        return {
          success: true,
          isAsync: true,
          task_id: taskId,
          status: data.status,
          message: data.message,
          url: url
        };
      }
      
      // Synchronous response
      console.log(`📊 Results type:`, typeof data.results);
      console.log(`📊 Results keys:`, Object.keys(data.results || {}));
      
      // Check if results is an array with HTML content
      let html = data.html || data.content || data.body;
      console.log(`📊 Initial html:`, typeof html, html?.length || 'N/A');
      
      console.log(`📊 Is Array:`, Array.isArray(data.results));
      console.log(`📊 Has length:`, data.results?.length);
      console.log(`📊 Has [0]:`, !!data.results?.['0']);
      
      if (Array.isArray(data.results) && data.results.length > 0) {
        console.log(`📊 Using array results[0]`);
        // Check if the array element has content property
        if (data.results[0].content) {
          console.log(`📊 Found content in array element, length:`, data.results[0].content.length);
          html = data.results[0].content;
        } else {
          html = data.results[0];
        }
      } else if (typeof data.results === 'object' && data.results['0']) {
        // Check if results[0] has content property
        console.log(`📊 Results[0] keys:`, Object.keys(data.results['0']));
        if (data.results['0'].content) {
          console.log(`📊 Found content, length:`, data.results['0'].content.length);
          html = data.results['0'].content;
        } else if (data.results['0'].html) {
          console.log(`📊 Found html, length:`, data.results['0'].html.length);
          html = data.results['0'].html;
        } else {
          console.log(`📊 Using results[0] directly`);
          html = data.results['0'];
        }
      } else if (typeof data.results === 'object' && data.results.html) {
        html = data.results.html;
      } else if (typeof data.results === 'string') {
        html = data.results;
      }
      
      return {
        success: true,
        isAsync: false,
        html: html,
        status: data.status,
        headers: data.headers,
        url: data.url,
        rawData: data // For debugging
      };

    } catch (error) {
      console.error(`❌ Decodo API: Failed to scrape ${url}:`, error.message);
      return {
        success: false,
        error: error.message,
        url: url
      };
    }
  }

  /**
   * Scrape multiple URLs in batch (asynchronous)
   * @param {Array<string>} urls - Array of URLs to scrape
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Batch job info
   */
  async scrapeBatch(urls, options = {}) {
    const payload = {
      urls: urls,
      // Core plan doesn't support headless mode
      ...options
    };

    try {
      console.log(`🔄 Decodo API: Starting batch scrape for ${urls.length} URLs`);
      
      const response = await fetch(`${this.baseUrl}/task/batch`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Decodo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`✅ Decodo API: Batch job started with ID: ${data.task_id}`);
      return {
        success: true,
        task_id: data.task_id,
        status: data.status
      };

    } catch (error) {
      console.error(`❌ Decodo API: Failed to start batch scrape:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check status of batch job
   * @param {string} taskId - Task ID from batch scrape
   * @returns {Promise<Object>} - Job status and results
   */
  async getBatchStatus(taskId) {
    try {
      // Try different endpoints to get task status/result
      const endpoints = [
        `${this.baseUrl}/task/${taskId}`,
        `${this.baseUrl}/task/${taskId}/result`,
        `${this.baseUrl}/result/${taskId}`,
        `${this.baseUrl}/task/${taskId}/status`
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Trying endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Found working endpoint: ${endpoint}`);
            console.log(`📊 Task ${taskId} status:`, data.status);
            
            return {
              success: true,
              status: data.status,
              results: data.results || data.content || data.html || data.body,
              completed: data.status === 'completed' || data.status === 'success' || data.status === 'finished',
              rawData: data
            };
          } else {
            console.log(`❌ Endpoint ${endpoint} returned ${response.status}`);
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} failed: ${error.message}`);
        }
      }
      
      throw new Error('All status endpoints failed');

    } catch (error) {
      console.error(`❌ Decodo API: Failed to get batch status:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Poll for async task results
   * @param {string} taskId - Task ID from async request
   * @param {number} maxAttempts - Maximum polling attempts
   * @param {number} delayMs - Delay between polls in milliseconds
   * @returns {Promise<Object>} - Final result
   */
  async pollAsyncResult(taskId, maxAttempts = 30, delayMs = 2000) {
    console.log(`🔄 Polling for task ${taskId} (max ${maxAttempts} attempts, ${delayMs}ms delay)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statusResult = await this.getBatchStatus(taskId);
        
        if (!statusResult.success) {
          console.error(`❌ Failed to get status for task ${taskId}:`, statusResult.error);
          return { success: false, error: statusResult.error };
        }
        
        console.log(`📊 Attempt ${attempt}/${maxAttempts}: Status = ${statusResult.status}`);
        
        if (statusResult.completed) {
          console.log(`✅ Task ${taskId} completed successfully`);
          return {
            success: true,
            html: statusResult.results?.html || statusResult.results?.content,
            status: statusResult.status,
            results: statusResult.results
          };
        }
        
        if (statusResult.status === 'failed') {
          console.error(`❌ Task ${taskId} failed`);
          return { success: false, error: 'Task failed' };
        }
        
        // Wait before next poll
        if (attempt < maxAttempts) {
          console.log(`⏳ Waiting ${delayMs}ms before next poll...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        console.error(`❌ Error polling task ${taskId} (attempt ${attempt}):`, error.message);
        if (attempt === maxAttempts) {
          return { success: false, error: error.message };
        }
      }
    }
    
    console.error(`❌ Task ${taskId} timed out after ${maxAttempts} attempts`);
    return { success: false, error: 'Polling timeout' };
  }

  /**
   * Test the API connection
   * @returns {Promise<Object>} - Test result
   */
  async testConnection() {
    try {
      console.log('🔍 Testing Decodo API connection...');
      
      const result = await this.scrape('https://ip.decodo.com');
      
      if (result.success) {
        console.log('✅ Decodo API: Connection test successful');
        return { success: true, message: 'API connection working' };
      } else {
        console.log('❌ Decodo API: Connection test failed');
        return { success: false, message: result.error };
      }
      
    } catch (error) {
      console.error('❌ Decodo API: Connection test error:', error.message);
      return { success: false, message: error.message };
    }
  }
}

export default DecodoAPI;
