#!/usr/bin/env node

// Enterprise Monitoring Dashboard
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { queueManager } from './queue-manager.js';
import { workerMetrics, workerHealthCheck } from './queue-worker.js';
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());

// Real-time metrics storage
let realTimeMetrics = {
  systemHealth: 'healthy',
  lastUpdate: new Date().toISOString(),
  queueStats: {},
  workerStats: {},
  databaseStats: {},
  alerts: []
};

// Update metrics every 30 seconds
setInterval(updateMetrics, 30000);

// Dashboard routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Zillow Scraper Enterprise Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #2c3e50; }
            .metric-value { font-size: 24px; font-weight: bold; color: #27ae60; }
            .metric-subtitle { color: #7f8c8d; font-size: 14px; }
            .status-healthy { color: #27ae60; }
            .status-warning { color: #f39c12; }
            .status-error { color: #e74c3c; }
            .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
            .refresh-btn:hover { background: #2980b9; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 Zillow Scraper Enterprise Dashboard</h1>
                <p>Real-time monitoring and metrics for the enterprise scraping system</p>
                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">System Health</div>
                    <div class="metric-value status-healthy" id="systemHealth">Healthy</div>
                    <div class="metric-subtitle">Last updated: <span id="lastUpdate">-</span></div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Queue Status</div>
                    <div class="metric-value" id="queueStatus">-</div>
                    <div class="metric-subtitle">Active: <span id="activeJobs">-</span> | Waiting: <span id="waitingJobs">-</span></div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Worker Performance</div>
                    <div class="metric-value" id="workerPerformance">-</div>
                    <div class="metric-subtitle">Success Rate: <span id="successRate">-</span>%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Database Stats</div>
                    <div class="metric-value" id="databaseStats">-</div>
                    <div class="metric-subtitle">Current: <span id="currentListings">-</span> | Previous: <span id="previousListings">-</span></div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Processing Speed</div>
                    <div class="metric-value" id="processingSpeed">-</div>
                    <div class="metric-subtitle">Listings/Hour: <span id="listingsPerHour">-</span></div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Recent Activity</div>
                    <div class="metric-value" id="recentActivity">-</div>
                    <div class="metric-subtitle">Cities Processed: <span id="citiesProcessed">-</span></div>
                </div>
            </div>
        </div>
        
        <script>
            // Auto-refresh every 30 seconds
            setInterval(() => {
                fetch('/api/metrics')
                    .then(response => response.json())
                    .then(data => updateDashboard(data))
                    .catch(error => console.error('Error fetching metrics:', error));
            }, 30000);
            
            function updateDashboard(data) {
                document.getElementById('systemHealth').textContent = data.systemHealth;
                document.getElementById('systemHealth').className = 'metric-value status-' + (data.systemHealth === 'healthy' ? 'healthy' : 'error');
                document.getElementById('lastUpdate').textContent = new Date(data.lastUpdate).toLocaleString();
                document.getElementById('queueStatus').textContent = data.queueStats.total || 0;
                document.getElementById('activeJobs').textContent = data.queueStats.active || 0;
                document.getElementById('waitingJobs').textContent = data.queueStats.waiting || 0;
                document.getElementById('workerPerformance').textContent = data.workerStats.totalJobs || 0;
                document.getElementById('successRate').textContent = data.workerStats.successRate || 0;
                document.getElementById('databaseStats').textContent = (data.databaseStats.current || 0) + (data.databaseStats.previous || 0);
                document.getElementById('currentListings').textContent = data.databaseStats.current || 0;
                document.getElementById('previousListings').textContent = data.databaseStats.previous || 0;
                document.getElementById('processingSpeed').textContent = Math.round(data.workerStats.listingsPerHour || 0);
                document.getElementById('listingsPerHour').textContent = Math.round(data.workerStats.listingsPerHour || 0);
                document.getElementById('recentActivity').textContent = data.workerStats.uptime || 0;
                document.getElementById('citiesProcessed').textContent = data.workerStats.citiesProcessed?.length || 0;
            }
            
            // Initial load
            fetch('/api/metrics')
                .then(response => response.json())
                .then(data => updateDashboard(data))
                .catch(error => console.error('Error fetching metrics:', error));
        </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await getComprehensiveMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const health = await workerHealthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/worker/metrics', (req, res) => {
  try {
    const metrics = workerMetrics.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/stats', async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive metrics
async function getComprehensiveMetrics() {
  try {
    const [queueStats, workerStats, databaseStats, health] = await Promise.all([
      queueManager.getQueueStats(),
      workerMetrics.getMetrics(),
      getDatabaseStats(),
      workerHealthCheck()
    ]);

    const metrics = {
      systemHealth: health.status,
      lastUpdate: new Date().toISOString(),
      queueStats,
      workerStats,
      databaseStats,
      alerts: generateAlerts(queueStats, workerStats, databaseStats, health)
    };

    realTimeMetrics = metrics;
    return metrics;
    
  } catch (error) {
    console.error('Error getting comprehensive metrics:', error);
    return {
      systemHealth: 'error',
      lastUpdate: new Date().toISOString(),
      error: error.message
    };
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    const [currentResult, previousResult] = await Promise.all([
      supabase.from('current_listings').select('*', { count: 'exact', head: true }),
      supabase.from('previous_listings').select('*', { count: 'exact', head: true })
    ]);

    return {
      current: currentResult.count || 0,
      previous: previousResult.count || 0,
      total: (currentResult.count || 0) + (previousResult.count || 0)
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return { current: 0, previous: 0, total: 0, error: error.message };
  }
}

// Generate alerts based on metrics
function generateAlerts(queueStats, workerStats, databaseStats, health) {
  const alerts = [];

  // Queue alerts
  if (queueStats.failed > 10) {
    alerts.push({
      type: 'error',
      message: `High number of failed jobs: ${queueStats.failed}`,
      timestamp: new Date().toISOString()
    });
  }

  if (queueStats.waiting > 50) {
    alerts.push({
      type: 'warning',
      message: `Queue backlog: ${queueStats.waiting} jobs waiting`,
      timestamp: new Date().toISOString()
    });
  }

  // Worker alerts
  if (workerStats.successRate < 80) {
    alerts.push({
      type: 'warning',
      message: `Low success rate: ${workerStats.successRate}%`,
      timestamp: new Date().toISOString()
    });
  }

  // Database alerts
  if (databaseStats.current === 0 && databaseStats.previous > 0) {
    alerts.push({
      type: 'warning',
      message: 'Current listings table is empty - may need to run scraper',
      timestamp: new Date().toISOString()
    });
  }

  // Health alerts
  if (health.status !== 'healthy') {
    alerts.push({
      type: 'error',
      message: `System health issue: ${health.error}`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

// Update metrics function
async function updateMetrics() {
  try {
    await getComprehensiveMetrics();
    console.log('📊 Metrics updated:', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error updating metrics:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Monitoring dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard URL: http://localhost:${PORT}`);
  console.log(`🔍 API endpoints:`);
  console.log(`   - GET /api/metrics - Comprehensive metrics`);
  console.log(`   - GET /api/health - System health check`);
  console.log(`   - GET /api/queue/stats - Queue statistics`);
  console.log(`   - GET /api/worker/metrics - Worker metrics`);
  console.log(`   - GET /api/database/stats - Database statistics`);
});

export default app;
