// Script to run a region for the first time (skip detection)
import { main } from '../zillow.js';
import { REGIONS } from '../config/regions.js';

const regionKey = process.argv[2];
if (!regionKey) {
  console.error('Usage: node scripts/run-region-first-time.js <region-key>');
  console.error('Available regions:', Object.keys(REGIONS).join(', '));
  process.exit(1);
}

if (!REGIONS[regionKey]) {
  console.error(`❌ Invalid region: ${regionKey}`);
  console.error('Available regions:', Object.keys(REGIONS).join(', '));
  process.exit(1);
}

console.log(`🚀 Starting FIRST-TIME scraper for region: ${REGIONS[regionKey].name}`);
console.log(`📍 Cities: ${REGIONS[regionKey].cities.map(c => c.name).join(', ')}`);
console.log(`ℹ️  Detection will be SKIPPED - just populating database`);
console.log('');

// Run with skipDetection = true
main([regionKey], true).catch(console.error);