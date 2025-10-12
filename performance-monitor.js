// Performance monitoring enhancement for the working system
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: null,
      endTime: null,
      totalCities: 0,
      successfulCities: 0,
      failedCities: 0,
      totalListings: 0,
      proxyStats: {
        decodo: { requests: 0, successes: 0, failures: 0 },
        smartproxy: { requests: 0, successes: 0, failures: 0 },
        stormproxy: { requests: 0, successes: 0, failures: 0 }
      },
      cityStats: new Map(),
      regionStats: new Map(),
      errors: []
    };
  }

  start() {
    this.metrics.startTime = Date.now();
    console.log('📊 Performance monitoring started');
  }

  end() {
    this.metrics.endTime = Date.now();
    const duration = this.metrics.endTime - this.metrics.startTime;
    console.log(`📊 Performance monitoring completed in ${(duration / 1000).toFixed(2)}s`);
    return this.getSummary();
  }

  recordCityStart(cityName, region) {
    this.metrics.totalCities++;
    this.metrics.cityStats.set(cityName, {
      startTime: Date.now(),
      region,
      listings: 0,
      pages: 0,
      errors: 0,
      proxyUsed: null
    });
  }

  recordCityEnd(cityName, success, listings = 0, pages = 0, proxyUsed = null) {
    const cityStat = this.metrics.cityStats.get(cityName);
    if (cityStat) {
      cityStat.endTime = Date.now();
      cityStat.duration = cityStat.endTime - cityStat.startTime;
      cityStat.success = success;
      cityStat.listings = listings;
      cityStat.pages = pages;
      cityStat.proxyUsed = proxyUsed;
    }

    if (success) {
      this.metrics.successfulCities++;
      this.metrics.totalListings += listings;
    } else {
      this.metrics.failedCities++;
    }
  }

  recordProxyUsage(proxyType, success) {
    const proxyStat = this.metrics.proxyStats[proxyType];
    if (proxyStat) {
      proxyStat.requests++;
      if (success) {
        proxyStat.successes++;
      } else {
        proxyStat.failures++;
      }
    }
  }

  recordError(error, context = '') {
    this.metrics.errors.push({
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  getSummary() {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const successRate = this.metrics.totalCities > 0 
      ? (this.metrics.successfulCities / this.metrics.totalCities * 100).toFixed(1)
      : 0;
    
    const listingsPerMinute = duration > 0 
      ? (this.metrics.totalListings / (duration / 60000)).toFixed(1)
      : 0;

    return {
      duration: duration / 1000, // seconds
      totalCities: this.metrics.totalCities,
      successfulCities: this.metrics.successfulCities,
      failedCities: this.metrics.failedCities,
      totalListings: this.metrics.totalListings,
      successRate: parseFloat(successRate),
      listingsPerMinute: parseFloat(listingsPerMinute),
      proxyStats: this.metrics.proxyStats,
      cityStats: Object.fromEntries(this.metrics.cityStats),
      errors: this.metrics.errors
    };
  }

  getProxyPerformance() {
    const proxyStats = this.metrics.proxyStats;
    const performance = {};
    
    for (const [proxy, stats] of Object.entries(proxyStats)) {
      if (stats.requests > 0) {
        performance[proxy] = {
          requests: stats.requests,
          successRate: (stats.successes / stats.requests * 100).toFixed(1),
          failures: stats.failures
        };
      }
    }
    
    return performance;
  }

  getCityPerformance() {
    const cityStats = Array.from(this.metrics.cityStats.values());
    return cityStats
      .filter(city => city.success)
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 10); // Top 10 performing cities
  }
}

// Export for use in the working system
export default PerformanceMonitor;
