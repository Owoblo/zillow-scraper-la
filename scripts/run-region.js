// Run scraper for a specific region
import { main } from '../zillow.js';
import { getRegionKeys, REGIONS } from '../config/regions.js';

const regionKey = process.argv[2];
const skipDetection = process.argv[3] === '--skip-detection';

if (!regionKey) {
  console.error('❌ Usage: node scripts/run-region.js <region-key> [--skip-detection]');
  console.error('   --skip-detection: Skip detection logic (for first-time runs)');
  console.error('\n📋 Available regions:');
  getRegionKeys().forEach(key => {
    const region = REGIONS[key];
    console.error(`   - ${key}: ${region.name} (${region.cities.length} cities)`);
  });
  process.exit(1);
}

const region = REGIONS[regionKey];
if (!region) {
  console.error(`❌ Region '${regionKey}' not found.`);
  console.error('\n📋 Available regions:');
  getRegionKeys().forEach(key => {
    const region = REGIONS[key];
    console.error(`   - ${key}: ${region.name} (${region.cities.length} cities)`);
  });
  process.exit(1);
}

console.log(`🚀 Starting scraper for region: ${region.name}`);
console.log(`📍 Cities: ${region.cities.map(c => c.name).join(', ')}`);
if (skipDetection) {
  console.log(`⏭️  Skipping detection (first-time run) - just populating database`);
}

main([regionKey], skipDetection).catch(console.error);
