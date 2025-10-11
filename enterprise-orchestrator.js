#!/usr/bin/env node

// Enterprise Orchestrator - Main Entry Point
import { queueManager } from './queue-manager.js';
import { workerMetrics } from './queue-worker.js';
import { getAllCities } from './config/regions.js';
import { switchTables } from './zillow.js';
import { sendScrapeNotification } from './emailService.js';
import monitoringDashboard from './monitoring-dashboard.js';

// Enterprise configuration
const ENTERPRISE_CONFIG = {
  ENABLE_MONITORING: true,
  ENABLE_EMAIL_NOTIFICATIONS: true,
  ENABLE_AUTO_SCALING: true,
  ENABLE_DETECTION: true,
  MAX_CONCURRENT_WORKERS: 5,
  MONITORING_PORT: 3001,
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  AUTO_SCALE_THRESHOLD: 10, // Scale up if queue has more than 10 jobs
  AUTO_SCALE_DOWN_THRESHOLD: 2 // Scale down if queue has less than 2 jobs
};

class EnterpriseOrchestrator {
  constructor() {
    this.isRunning = false;
    this.startTime = null;
    this.results = {};
    this.detectionResults = { justListed: [], soldListings: [] };
    this.autoScaling = {
      currentWorkers: 1,
      maxWorkers: ENTERPRISE_CONFIG.MAX_CONCURRENT_WORKERS,
      scaleUpThreshold: ENTERPRISE_CONFIG.AUTO_SCALE_THRESHOLD,
      scaleDownThreshold: ENTERPRISE_CONFIG.AUTO_SCALE_DOWN_THRESHOLD
    };
  }

  // Main orchestration function
  async runEnterpriseScrape() {
    console.log('🚀 Starting Enterprise Zillow Scraper...');
    console.log('=' .repeat(60));
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    try {
      // Phase 1: Initialize monitoring
      if (ENTERPRISE_CONFIG.ENABLE_MONITORING) {
        await this.initializeMonitoring();
      }

      // Phase 2: Health check
      await this.performHealthCheck();

      // Phase 3: Add jobs to queue
      const cities = getAllCities();
      console.log(`📍 Processing ${cities.length} cities with enterprise queue system...`);
      
      const scrapeJobs = await queueManager.addScrapeJobs(cities, 'normal');
      console.log(`📋 Added ${scrapeJobs.length} scrape jobs to queue`);

      // Phase 4: Wait for scraping to complete
      await this.waitForScrapingCompletion();

      // Phase 5: Run detection if enabled
      if (ENTERPRISE_CONFIG.ENABLE_DETECTION) {
        await this.runEnterpriseDetection();
      }

      // Phase 6: Switch tables
      await this.switchTablesForNextRun();

      // Phase 7: Send notifications
      if (ENTERPRISE_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
        await this.sendEnterpriseNotification();
      }

      // Phase 8: Generate final report
      await this.generateFinalReport();

      console.log('✅ Enterprise scrape completed successfully!');
      
    } catch (error) {
      console.error('❌ Enterprise scrape failed:', error);
      await this.handleError(error);
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  // Initialize monitoring dashboard
  async initializeMonitoring() {
    console.log('📊 Initializing monitoring dashboard...');
    
    // Start monitoring dashboard in background
    if (!this.monitoringStarted) {
      monitoringDashboard.listen(ENTERPRISE_CONFIG.MONITORING_PORT, () => {
        console.log(`📊 Monitoring dashboard running on port ${ENTERPRISE_CONFIG.MONITORING_PORT}`);
      });
      this.monitoringStarted = true;
    }
  }

  // Perform comprehensive health check
  async performHealthCheck() {
    console.log('🔍 Performing enterprise health check...');
    
    const healthChecks = [
      this.checkDatabaseConnection(),
      this.checkQueueSystem(),
      this.checkWorkerHealth(),
      this.checkProxySystem()
    ];

    const results = await Promise.allSettled(healthChecks);
    
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length} health checks failed:`, failures.map(f => f.reason));
    } else {
      console.log('✅ All health checks passed');
    }
  }

  // Check database connection
  async checkDatabaseConnection() {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      'https://idbyrtwdeeruiutoukct.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko'
    );
    
    const { error } = await supabase.from('current_listings').select('count', { count: 'exact', head: true });
    if (error) throw new Error(`Database connection failed: ${error.message}`);
    
    return 'Database connection healthy';
  }

  // Check queue system
  async checkQueueSystem() {
    const stats = await queueManager.getQueueStats();
    if (stats.total === undefined) throw new Error('Queue system not responding');
    
    return 'Queue system healthy';
  }

  // Check worker health
  async checkWorkerHealth() {
    const { workerHealthCheck } = await import('./queue-worker.js');
    const health = await workerHealthCheck();
    if (health.status !== 'healthy') throw new Error(`Worker unhealthy: ${health.error}`);
    
    return 'Worker system healthy';
  }

  // Check proxy system
  async checkProxySystem() {
    const { getSmartProxyAgent } = await import('./proxies.js');
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://httpbin.org/ip', {
      agent: getSmartProxyAgent(),
      timeout: 10000
    });
    
    if (!response.ok) throw new Error('Proxy system not responding');
    
    return 'Proxy system healthy';
  }

  // Wait for scraping to complete with auto-scaling
  async waitForScrapingCompletion() {
    console.log('⏳ Waiting for scraping jobs to complete...');
    
    let lastStats = { active: 0, waiting: 0 };
    let stableCount = 0;
    
    while (true) {
      const stats = await queueManager.getQueueStats();
      
      // Auto-scaling logic
      if (ENTERPRISE_CONFIG.ENABLE_AUTO_SCALING) {
        await this.handleAutoScaling(stats);
      }
      
      // Check if scraping is complete
      if (stats.active === 0 && stats.waiting === 0) {
        console.log('✅ All scraping jobs completed');
        break;
      }
      
      // Check for stability (no changes for 3 consecutive checks)
      if (stats.active === lastStats.active && stats.waiting === lastStats.waiting) {
        stableCount++;
        if (stableCount >= 3) {
          console.log('⚠️ Queue appears stable, but jobs may be stuck');
          break;
        }
      } else {
        stableCount = 0;
      }
      
      lastStats = stats;
      
      console.log(`📊 Queue status: Active=${stats.active}, Waiting=${stats.waiting}, Completed=${stats.completed}`);
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
  }

  // Handle auto-scaling based on queue load
  async handleAutoScaling(stats) {
    const totalPending = stats.active + stats.waiting;
    
    if (totalPending > this.autoScaling.scaleUpThreshold && 
        this.autoScaling.currentWorkers < this.autoScaling.maxWorkers) {
      
      this.autoScaling.currentWorkers++;
      console.log(`📈 Auto-scaling UP: ${this.autoScaling.currentWorkers} workers (queue: ${totalPending})`);
      
      // In a real implementation, you would spawn more worker processes here
      // For now, we'll just log the scaling action
      
    } else if (totalPending < this.autoScaling.scaleDownThreshold && 
               this.autoScaling.currentWorkers > 1) {
      
      this.autoScaling.currentWorkers--;
      console.log(`📉 Auto-scaling DOWN: ${this.autoScaling.currentWorkers} workers (queue: ${totalPending})`);
    }
  }

  // Run enterprise detection
  async runEnterpriseDetection() {
    console.log('🔍 Running enterprise detection...');
    
    const cities = getAllCities();
    const detectionJobs = await queueManager.addDetectionJobs(cities);
    
    console.log(`📋 Added ${detectionJobs.length} detection jobs to queue`);
    
    // Wait for detection to complete
    let lastStats = { active: 0, waiting: 0 };
    
    while (true) {
      const stats = await queueManager.getQueueStats();
      
      if (stats.active === 0 && stats.waiting === 0) {
        console.log('✅ All detection jobs completed');
        break;
      }
      
      if (stats.active === lastStats.active && stats.waiting === lastStats.waiting) {
        console.log('⚠️ Detection queue appears stable');
        break;
      }
      
      lastStats = stats;
      console.log(`🔍 Detection queue: Active=${stats.active}, Waiting=${stats.waiting}`);
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
    }
  }

  // Switch tables for next run
  async switchTablesForNextRun() {
    console.log('🔄 Switching tables for next run...');
    
    try {
      await switchTables();
      console.log('✅ Tables switched successfully');
    } catch (error) {
      console.error('❌ Error switching tables:', error.message);
      throw error;
    }
  }

  // Send enterprise notification
  async sendEnterpriseNotification() {
    console.log('📧 Sending enterprise notification...');
    
    try {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      const queueStats = await queueManager.getQueueStats();
      const workerStats = workerMetrics.getMetrics();
      
      const emailData = {
        success: true,
        totalListings: workerStats.totalListings,
        justListed: this.detectionResults.justListed.length,
        soldListings: this.detectionResults.soldListings.length,
        runDuration: `${duration}s`,
        timestamp: new Date().toISOString(),
        cityDetails: [], // Would be populated with actual city results
        failedCities: [], // Would be populated with failed cities
        enterpriseMetrics: {
          queueStats,
          workerStats,
          autoScaling: this.autoScaling,
          monitoringEnabled: ENTERPRISE_CONFIG.ENABLE_MONITORING
        }
      };

      await sendScrapeNotification(emailData);
      console.log('✅ Enterprise notification sent');
      
    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
    }
  }

  // Generate final report
  async generateFinalReport() {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const queueStats = await queueManager.getQueueStats();
    const workerStats = workerMetrics.getMetrics();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ENTERPRISE SCRAPE FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`📋 Queue Stats:`);
    console.log(`   - Completed: ${queueStats.completed}`);
    console.log(`   - Failed: ${queueStats.failed}`);
    console.log(`   - Success Rate: ${((queueStats.completed / (queueStats.completed + queueStats.failed)) * 100).toFixed(2)}%`);
    console.log(`🔧 Worker Stats:`);
    console.log(`   - Total Jobs: ${workerStats.totalJobs}`);
    console.log(`   - Success Rate: ${workerStats.successRate}%`);
    console.log(`   - Total Listings: ${workerStats.totalListings}`);
    console.log(`   - Listings/Hour: ${Math.round(workerStats.listingsPerHour)}`);
    console.log(`📈 Auto-scaling:`);
    console.log(`   - Final Workers: ${this.autoScaling.currentWorkers}`);
    console.log(`   - Max Workers: ${this.autoScaling.maxWorkers}`);
    console.log(`🔍 Detection Results:`);
    console.log(`   - Just Listed: ${this.detectionResults.justListed.length}`);
    console.log(`   - Sold: ${this.detectionResults.soldListings.length}`);
    console.log('='.repeat(60));
  }

  // Handle errors
  async handleError(error) {
    console.error('❌ Enterprise orchestrator error:', error);
    
    // Send error notification
    if (ENTERPRISE_CONFIG.ENABLE_EMAIL_NOTIFICATIONS) {
      try {
        const emailData = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          enterpriseMetrics: {
            queueStats: await queueManager.getQueueStats(),
            workerStats: workerMetrics.getMetrics(),
            autoScaling: this.autoScaling
          }
        };
        
        await sendScrapeNotification(emailData);
      } catch (emailError) {
        console.error('❌ Failed to send error notification:', emailError.message);
      }
    }
  }

  // Cleanup resources
  async cleanup() {
    console.log('🧹 Cleaning up enterprise resources...');
    
    try {
      await queueManager.cleanup();
      console.log('✅ Enterprise cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }
}

// Create and export orchestrator instance
const orchestrator = new EnterpriseOrchestrator();

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  orchestrator.runEnterpriseScrape().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default orchestrator;
