// Run scraper for all regions
import { main } from '../zillow.js';
import { getRegionKeys, REGIONS } from '../config/regions.js';

console.log('🚀 Starting scraper for all regions...');

// Show which regions will be processed
console.log('\n📋 Regions to process:');
getRegionKeys().forEach(key => {
  const region = REGIONS[key];
  console.log(`   - ${key}: ${region.name} (${region.cities.length} cities)`);
});

main().catch(console.error);
