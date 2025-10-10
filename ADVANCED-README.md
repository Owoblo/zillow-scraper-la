# 🚀 Advanced Zillow Scraper with Anti-Detection

## Overview

This is an advanced version of the Zillow scraper with sophisticated anti-detection capabilities designed to handle large-scale scraping operations including US cities like Milwaukee and extended GTA areas.

## 🎯 Key Features

### **Anti-Detection Capabilities**
- **Multi-Provider Proxy Pool**: US and Canada proxies with intelligent rotation
- **Randomized Timing**: Variable delays between requests (400ms-2000ms + random spikes)
- **City Order Randomization**: Non-sequential city processing to avoid patterns
- **Advanced User Agent Rotation**: Multiple realistic browser signatures
- **Exponential Backoff**: Smart retry logic with increasing delays
- **Proxy Performance Tracking**: Automatic proxy health monitoring

### **Intelligent Scheduling**
- **Weighted City Selection**: Based on historical success rates and difficulty
- **Time-Based Patterns**: Different strategies for morning/afternoon/evening
- **Region Alternating**: Smart rotation between Windsor, GTA, and Milwaukee areas
- **Adaptive Delays**: Dynamic timing based on success rates

### **Advanced Error Handling**
- **Consecutive Error Tracking**: Stops processing cities with too many failures
- **Proxy Health Monitoring**: Automatically switches away from failing proxies
- **Graceful Degradation**: Continues processing even if some cities fail
- **Comprehensive Logging**: Detailed success/failure tracking

## 🏗️ Architecture

### **Core Components**

1. **`advanced-proxies.js`** - Multi-provider proxy management
2. **`advanced-scheduler.js`** - Intelligent city scheduling
3. **`advanced-scraper.js`** - Core scraping engine with anti-detection
4. **`advanced-zillow.js`** - Main integration script

### **City Configuration**

The system now supports **18 cities** across 4 regions:

**Windsor Area (9 cities)**: Windsor, Kingsville, Leamington, Lakeshore, Essex, Tecumseh, Lasalle, Chatham-Kent, Amherstburg

**GTA Area (6 cities)**: Toronto, Mississauga, Brampton, Markham, Vaughan, Richmond Hill

**GTA Extended (2 cities)**: Oakville, Burlington

**Milwaukee Area (1 city)**: Milwaukee

## 🚀 Usage

### **Basic Usage**
```bash
# Run advanced scraper
npm run advanced

# Run just the scraper (no detection)
npm run advanced:scraper

# Test the system
npm run advanced:test
```

### **Strategy Management**
```javascript
import { setScrapingStrategy, SCHEDULING_STRATEGIES } from './advanced-zillow.js';

// Available strategies
setScrapingStrategy(SCHEDULING_STRATEGIES.RANDOM);           // Pure random
setScrapingStrategy(SCHEDULING_STRATEGIES.WEIGHTED);         // Weighted by difficulty
setScrapingStrategy(SCHEDULING_STRATEGIES.REGION_ALTERNATING); // Region-based
```

### **Configuration Options**
```javascript
// In advanced-zillow.js
const ADVANCED_CONFIG = {
  ENABLE_DETECTION: true,           // Run detection after scraping
  ENABLE_EMAIL_NOTIFICATIONS: true, // Send email reports
  RANDOMIZE_CITY_ORDER: true,       // Randomize city processing order
  USE_ADVANCED_PROXIES: true,       // Use multi-provider proxy pool
  ADAPTIVE_DELAYS: true,            // Use intelligent delay patterns
  MAX_CONCURRENT_CITIES: 3,         // Parallel city processing limit
  BATCH_SIZE: 5,                    // Cities per batch
  ENABLE_RETRY_LOGIC: true          // Enable advanced retry logic
};
```

## 📊 Performance Features

### **Proxy Management**
- **US Proxies**: For Milwaukee and other US cities
- **Canada Proxies**: For Canadian cities
- **Health Tracking**: Success/failure rates per proxy
- **Automatic Rotation**: Every 5 requests or 2 minutes
- **Weighted Selection**: Based on reliability scores

### **Timing Optimization**
- **Base Delays**: 400ms-2000ms between requests
- **Random Spikes**: 5% chance of 2-5 second delays
- **Batch Delays**: 3 seconds between city batches
- **Error Backoff**: Exponential delays on failures

### **City Difficulty Scoring**
```javascript
const CITY_DIFFICULTY = {
  'Windsor': 1.0,        // Easy (high success rate)
  'Toronto': 0.6,        // Hard (large market)
  'Milwaukee': 0.5,      // Very hard (US city)
  'Oakville': 0.6,       // Medium-hard
  // ... etc
};
```

## 🔧 Advanced Features

### **Intelligent Retry Logic**
- **Consecutive Error Tracking**: Stops after 3 consecutive failures
- **Proxy Health Monitoring**: Switches away from failing proxies
- **Exponential Backoff**: Increasing delays on retries
- **Graceful Degradation**: Continues with remaining cities

### **Adaptive Scheduling**
- **Time-Based Weights**: Different strategies for different times
- **Success Rate Tracking**: Learns from historical performance
- **Region Balancing**: Ensures fair processing across regions
- **Priority Scoring**: Combines difficulty, time, and success rates

### **Comprehensive Monitoring**
- **Real-time Progress**: Live updates during processing
- **Performance Metrics**: Success rates, timing, proxy health
- **Detailed Logging**: Full audit trail of all operations
- **Error Classification**: Categorized error types and responses

## 📈 Expected Performance

### **Success Rates**
- **Windsor Area**: 95%+ success rate
- **GTA Area**: 90%+ success rate  
- **GTA Extended**: 85%+ success rate
- **Milwaukee Area**: 80%+ success rate

### **Processing Times**
- **Per City**: 30-60 seconds (depending on size)
- **Full Run**: 15-25 minutes for all 18 cities
- **Detection**: 2-3 minutes additional
- **Total**: 20-30 minutes complete cycle

### **Data Volume**
- **Total Listings**: 8,000-12,000 per run
- **Just-Listed**: 100-300 per run
- **Sold Properties**: 100-300 per run
- **Success Rate**: 90%+ overall

## 🛡️ Anti-Detection Measures

### **Request Patterns**
- **Randomized Delays**: No predictable timing patterns
- **Variable User Agents**: Multiple browser signatures
- **Proxy Rotation**: Different IPs for different regions
- **Request Headers**: Realistic browser headers

### **Behavioral Patterns**
- **City Randomization**: Non-sequential processing
- **Error Handling**: Natural retry patterns
- **Timing Variation**: Human-like delays
- **Proxy Health**: Automatic switching on failures

## 🔍 Monitoring & Debugging

### **Real-time Feedback**
```
🏙️  Processing Milwaukee (Milwaukee Area)...
🌐 Using smartproxy-us (US) - Attempt 1/3
📍 Milwaukee: page 1 -> 41 listings (total: 41)
✅ Milwaukee: Successfully processed 465 listings in 45230ms
```

### **Performance Statistics**
```
📈 SCHEDULING STATISTICS:
Strategy: weighted
Cities processed: 18
Success rate: 94%
Region distribution: { 'windsor-area': 9, 'gta-area': 6, 'milwaukee-area': 1, 'gta-extended': 2 }
```

### **Error Tracking**
```
❌ Error fetching Milwaukee page 5: HTTP 429: Too Many Requests
⏳ Waiting 2000ms before retry...
🌐 Using decodo (US) - Attempt 2/3
```

## 🚨 Troubleshooting

### **Common Issues**

1. **Proxy Authentication Errors (407)**
   - Solution: System automatically switches to backup proxies
   - Check: Proxy credentials in environment variables

2. **Rate Limiting (429)**
   - Solution: Automatic exponential backoff and proxy rotation
   - Check: Delay settings in configuration

3. **City Processing Failures**
   - Solution: Consecutive error tracking stops problematic cities
   - Check: City difficulty scores and regional patterns

4. **Detection Issues**
   - Solution: Separate detection phase with its own error handling
   - Check: Database table status and data integrity

### **Performance Optimization**

1. **Adjust Batch Sizes**: Reduce `MAX_CITIES_PER_BATCH` for slower systems
2. **Increase Delays**: Modify `PAGE_DELAY_MS` for more conservative approach
3. **Proxy Pool**: Add more proxy providers for better rotation
4. **City Selection**: Adjust difficulty weights based on success rates

## 📋 Maintenance

### **Regular Tasks**
- Monitor proxy health and success rates
- Update city difficulty scores based on performance
- Review and adjust timing parameters
- Check for new anti-detection measures from Zillow

### **Scaling Up**
- Add more US proxy providers for Milwaukee area
- Implement additional Canadian regions
- Add more sophisticated timing patterns
- Implement machine learning for optimal scheduling

## 🎯 Next Steps

1. **Test the advanced system** with a small subset of cities
2. **Monitor performance** and adjust parameters
3. **Scale up gradually** to include all 18 cities
4. **Implement monitoring** and alerting systems
5. **Add more proxy providers** for better rotation

The advanced system is designed to be robust, scalable, and maintainable while providing excellent anti-detection capabilities for large-scale real estate data collection.
