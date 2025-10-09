#!/usr/bin/env node

// Schedule delayed retry script for Render cron jobs
// This script schedules the delayed retry to run 30 minutes after main scrape
// Usage: node scripts/schedule-delayed-retry.js

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

/**
 * Create a scheduled job that runs delayed retry after 30 minutes
 */
function scheduleDelayedRetry() {
  console.log('⏰ Scheduling delayed retry for 30 minutes from now...');
  
  try {
    // Create a simple delay script
    const delayScript = `
#!/bin/bash
echo "⏰ Waiting 30 minutes before running delayed retry..."
sleep 1800  # 30 minutes = 1800 seconds
echo "🚀 Running delayed retry now..."
npm run delayed:retry
`;
    
    writeFileSync('delayed-retry.sh', delayScript);
    
    // Make it executable
    execSync('chmod +x delayed-retry.sh', { stdio: 'inherit' });
    
    // Run it in background
    execSync('nohup ./delayed-retry.sh > delayed-retry.log 2>&1 &', { stdio: 'inherit' });
    
    console.log('✅ Delayed retry scheduled successfully!');
    console.log('📝 Check delayed-retry.log for progress');
    
  } catch (error) {
    console.error('❌ Error scheduling delayed retry:', error.message);
  }
}

/**
 * Main function
 */
function main() {
  console.log('📅 SCHEDULING DELAYED RETRY SYSTEM');
  console.log('==================================\n');
  
  scheduleDelayedRetry();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scheduleDelayedRetry };
