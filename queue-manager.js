#!/usr/bin/env node

// Enterprise Queue Management System
import Queue from 'bull';
import Redis from 'ioredis';
import { getAllCities } from './config/regions.js';
import { processCityWithQueue } from './queue-worker.js';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

// Create Redis connection
const redis = new Redis(redisConfig);

// Queue configuration
const QUEUE_CONFIG = {
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    stalledInterval: 30 * 1000,    // Check for stalled jobs every 30s
    maxStalledCount: 1,            // Max stalled jobs before failing
  }
};

// Create queues
export const scrapeQueue = new Queue('scrape jobs', { redis: redisConfig, ...QUEUE_CONFIG });
export const detectionQueue = new Queue('detection jobs', { redis: redisConfig, ...QUEUE_CONFIG });
export const notificationQueue = new Queue('notification jobs', { redis: redisConfig, ...QUEUE_CONFIG });

// Queue event handlers
scrapeQueue.on('completed', (job, result) => {
  console.log(`✅ Scrape job ${job.id} completed: ${result.listings} listings for ${job.data.city}`);
});

scrapeQueue.on('failed', (job, err) => {
  console.error(`❌ Scrape job ${job.id} failed for ${job.data.city}:`, err.message);
});

scrapeQueue.on('stalled', (job) => {
  console.warn(`⚠️ Scrape job ${job.id} stalled for ${job.data.city}`);
});

detectionQueue.on('completed', (job, result) => {
  console.log(`✅ Detection job ${job.id} completed: ${result.justListed} just-listed, ${result.sold} sold`);
});

detectionQueue.on('failed', (job, err) => {
  console.error(`❌ Detection job ${job.id} failed:`, err.message);
});

// Queue management functions
export class QueueManager {
  constructor() {
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      averageProcessingTime: 0,
      citiesProcessed: new Set(),
      startTime: Date.now()
    };
  }

  // Add cities to scrape queue with priority
  async addScrapeJobs(cities, priority = 'normal') {
    const jobs = [];
    
    for (const city of cities) {
      const jobData = {
        city: city.name,
        region: city.regionName,
        mapBounds: city.mapBounds,
        regionId: city.regionId,
        priority: this.getCityPriority(city.name),
        timestamp: Date.now()
      };

      const job = await scrapeQueue.add('scrape-city', jobData, {
        priority: this.getJobPriority(priority),
        delay: this.getRandomDelay(), // Stagger job starts
        jobId: `scrape-${city.name}-${Date.now()}`
      });

      jobs.push(job);
      this.metrics.totalJobs++;
    }

    console.log(`📋 Added ${jobs.length} scrape jobs to queue`);
    return jobs;
  }

  // Add detection jobs
  async addDetectionJobs(cities) {
    const jobs = [];
    
    for (const city of cities) {
      const jobData = {
        city: city.name,
        timestamp: Date.now()
      };

      const job = await detectionQueue.add('detect-city', jobData, {
        priority: this.getJobPriority('high'),
        delay: 5000, // Wait 5 seconds after scraping
        jobId: `detect-${city.name}-${Date.now()}`
      });

      jobs.push(job);
    }

    console.log(`🔍 Added ${jobs.length} detection jobs to queue`);
    return jobs;
  }

  // Get city priority based on size and importance
  getCityPriority(cityName) {
    const priorityMap = {
      'Toronto': 1,      // Highest priority
      'Mississauga': 2,
      'Brampton': 2,
      'Markham': 3,
      'Vaughan': 3,
      'Richmond Hill': 3,
      'Milwaukee': 4,
      'Windsor': 5,
      'Oakville': 5,
      'Burlington': 5,
      // Default for smaller cities
    };
    
    return priorityMap[cityName] || 10;
  }

  // Convert priority to Bull queue priority
  getJobPriority(priority) {
    const priorityMap = {
      'high': 1,
      'normal': 5,
      'low': 10
    };
    
    return priorityMap[priority] || 5;
  }

  // Get random delay to stagger job starts
  getRandomDelay() {
    return Math.floor(Math.random() * 10000) + 1000; // 1-11 seconds
  }

  // Get queue statistics
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      scrapeQueue.getWaiting(),
      scrapeQueue.getActive(),
      scrapeQueue.getCompleted(),
      scrapeQueue.getFailed(),
      scrapeQueue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }

  // Get processing metrics
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      ...this.metrics,
      uptime: Math.floor(uptime / 1000),
      successRate: this.metrics.totalJobs > 0 ? 
        (this.metrics.completedJobs / this.metrics.totalJobs * 100).toFixed(2) : 0,
      citiesProcessed: Array.from(this.metrics.citiesProcessed)
    };
  }

  // Update metrics
  updateMetrics(jobResult) {
    if (jobResult.success) {
      this.metrics.completedJobs++;
      this.metrics.citiesProcessed.add(jobResult.city);
    } else {
      this.metrics.failedJobs++;
    }
    
    this.metrics.activeJobs = Math.max(0, this.metrics.activeJobs - 1);
  }

  // Clean up queues
  async cleanup() {
    await Promise.all([
      scrapeQueue.clean(24 * 60 * 60 * 1000, 'completed'), // Clean completed jobs older than 24h
      scrapeQueue.clean(24 * 60 * 60 * 1000, 'failed'),    // Clean failed jobs older than 24h
      detectionQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      detectionQueue.clean(24 * 60 * 60 * 1000, 'failed')
    ]);
    
    console.log('🧹 Queue cleanup completed');
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down queue manager...');
    
    await Promise.all([
      scrapeQueue.close(),
      detectionQueue.close(),
      notificationQueue.close(),
      redis.disconnect()
    ]);
    
    console.log('✅ Queue manager shutdown complete');
  }
}

// Export singleton instance
export const queueManager = new QueueManager();

// Process jobs
scrapeQueue.process('scrape-city', 5, processCityWithQueue); // Process 5 jobs concurrently
detectionQueue.process('detect-city', 3, async (job) => {
  const { city } = job.data;
  console.log(`🔍 Processing detection for ${city}...`);
  
  // Import detection function
  const { detectJustListedAndSoldByRegion } = await import('./zillow.js');
  
  try {
    const result = await detectJustListedAndSoldByRegion(null, null, [city]);
    return { success: true, city, ...result };
  } catch (error) {
    console.error(`❌ Detection failed for ${city}:`, error.message);
    return { success: false, city, error: error.message };
  }
});

// Auto-cleanup every hour
setInterval(() => {
  queueManager.cleanup();
}, 60 * 60 * 1000);

export default QueueManager;
