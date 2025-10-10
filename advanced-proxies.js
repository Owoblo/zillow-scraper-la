import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// Advanced proxy pool with multiple providers and regions
const PROXY_POOLS = {
  // US Proxies (for US cities like Milwaukee)
  us: [
    {
      provider: 'decodo',
      host: 'isp.decodo.com',
      port: 10001,
      username: 'user-spob1kyjck-ip-82.23.110.71',
      password: 'sma7j92aJikN~zIBc2',
      region: 'US',
      reliability: 0.95
    },
    {
      provider: 'smartproxy-us',
      host: 'us.smartproxy.com',
      port: 20000,
      username: process.env.SMARTPROXY_USER,
      password: process.env.SMARTPROXY_PASS,
      region: 'US',
      reliability: 0.90
    }
  ],
  
  // Canada Proxies (for Canadian cities)
  ca: [
    {
      provider: 'decodo-ca',
      host: 'isp.decodo.com',
      port: 10001,
      username: 'user-spob1kyjck-ip-82.23.110.71',
      password: 'sma7j92aJikN~zIBc2',
      region: 'CA',
      reliability: 0.95
    },
    {
      provider: 'smartproxy-ca',
      host: 'ca.smartproxy.com',
      port: 20000,
      username: process.env.SMARTPROXY_USER,
      password: process.env.SMARTPROXY_PASS,
      region: 'CA',
      reliability: 0.90
    }
  ]
};

// Proxy rotation state
let proxyRotationState = {
  currentIndex: 0,
  lastUsed: {},
  failures: {},
  successCount: {},
  lastRotation: Date.now()
};

// Advanced proxy selection with intelligent rotation
export function getAdvancedProxyAgent(cityRegion = 'CA') {
  const pool = PROXY_POOLS[cityRegion] || PROXY_POOLS.ca;
  
  // Rotate every 5 requests or every 2 minutes
  const shouldRotate = 
    proxyRotationState.currentIndex >= 5 || 
    (Date.now() - proxyRotationState.lastRotation) > 120000;
  
  if (shouldRotate) {
    proxyRotationState.currentIndex = 0;
    proxyRotationState.lastRotation = Date.now();
  }
  
  // Select proxy with weighted random selection based on reliability
  const availableProxies = pool.filter(proxy => {
    const failures = proxyRotationState.failures[proxy.provider] || 0;
    return failures < 3; // Skip proxies with too many failures
  });
  
  if (availableProxies.length === 0) {
    // Reset failures if all proxies are marked as failed
    proxyRotationState.failures = {};
    return getAdvancedProxyAgent(cityRegion);
  }
  
  // Weighted selection based on reliability and recent success
  const weightedProxies = availableProxies.map(proxy => {
    const successCount = proxyRotationState.successCount[proxy.provider] || 0;
    const failures = proxyRotationState.failures[proxy.provider] || 0;
    const weight = proxy.reliability + (successCount * 0.1) - (failures * 0.2);
    return { ...proxy, weight: Math.max(weight, 0.1) };
  });
  
  // Select proxy using weighted random
  const totalWeight = weightedProxies.reduce((sum, proxy) => sum + proxy.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedProxy = weightedProxies[0];
  for (const proxy of weightedProxies) {
    random -= proxy.weight;
    if (random <= 0) {
      selectedProxy = proxy;
      break;
    }
  }
  
  // Create proxy agent
  const agent = new HttpsProxyAgent({
    host: selectedProxy.host,
    port: selectedProxy.port,
    username: selectedProxy.username,
    password: selectedProxy.password,
  });
  
  // Track usage
  proxyRotationState.currentIndex++;
  proxyRotationState.lastUsed[selectedProxy.provider] = Date.now();
  
  return { agent, proxy: selectedProxy };
}

// Track proxy performance
export function trackProxySuccess(proxyProvider) {
  proxyRotationState.successCount[proxyProvider] = 
    (proxyRotationState.successCount[proxyProvider] || 0) + 1;
}

export function trackProxyFailure(proxyProvider) {
  proxyRotationState.failures[proxyProvider] = 
    (proxyRotationState.failures[proxyProvider] || 0) + 1;
}

// Get random delay between requests (anti-detection)
export function getRandomDelay() {
  // Base delay between 400ms and 2000ms
  const baseDelay = 400 + Math.random() * 1600;
  
  // Add occasional longer delays (1-5% of requests)
  const longDelayChance = Math.random();
  if (longDelayChance < 0.03) {
    return baseDelay + (2000 + Math.random() * 3000);
  }
  
  return baseDelay;
}

// Get random user agent
export function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Advanced request with retry logic and proxy rotation
export async function advancedFetch(url, options = {}, cityRegion = 'CA', maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { agent, proxy } = getAdvancedProxyAgent(cityRegion);
      
      const requestOptions = {
        ...options,
        agent,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...options.headers
        }
      };
      
      console.log(`🌐 Using ${proxy.provider} (${proxy.region}) - Attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(url, requestOptions);
      
      if (response.ok) {
        trackProxySuccess(proxy.provider);
        return response;
      } else if (response.status === 407) {
        // Proxy authentication failed
        console.log(`❌ Proxy auth failed: ${proxy.provider}`);
        trackProxyFailure(proxy.provider);
        lastError = new Error(`Proxy authentication failed: ${response.status}`);
      } else if (response.status === 429) {
        // Rate limited
        console.log(`⏳ Rate limited, waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
        lastError = new Error(`Rate limited: ${response.status}`);
      } else {
        console.log(`❌ HTTP ${response.status} with ${proxy.provider}`);
        trackProxyFailure(proxy.provider);
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`❌ Network error on attempt ${attempt}: ${error.message}`);
      lastError = error;
    }
    
    // Wait before retry with exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Legacy compatibility
export function getSmartProxyAgent() {
  return getAdvancedProxyAgent('CA').agent;
}
