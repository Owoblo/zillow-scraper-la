#!/usr/bin/env node

// Manual trigger script for KWG area scraping
// Usage: node trigger-kwg.js

import { main } from './zillow.js';

console.log('🚀 Manual KWG Area Trigger');
console.log('📍 Scraping Kitchener, Waterloo, Guelph...');
console.log('⏭️  Skip detection mode - populating previous listings');

// Run the scraper for KWG area only, skip detection
main(['kwg-area'], true)
  .then(() => {
    console.log('✅ KWG area scraping completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ KWG area scraping failed:', error);
    process.exit(1);
  });
