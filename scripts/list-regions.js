// List all available regions and their cities
import { getRegionKeys, REGIONS } from '../config/regions.js';

console.log('📋 Available Regions:\n');

getRegionKeys().forEach(key => {
  const region = REGIONS[key];
  console.log(`🏙️  ${key}: ${region.name}`);
  console.log(`   Cities (${region.cities.length}):`);
  region.cities.forEach(city => {
    console.log(`   - ${city.name} (Region ID: ${city.regionId})`);
  });
  console.log('');
});

console.log('💡 Usage:');
console.log('   node scripts/run-region.js <region-key>  # Run specific region');
console.log('   node scripts/run-all-regions.js         # Run all regions');
console.log('   node zillow.js <region-key>             # Run specific region (direct)');
console.log('   node zillow.js                          # Run all regions (direct)');
