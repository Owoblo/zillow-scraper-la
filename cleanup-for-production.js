// cleanup-for-production.js - Remove unnecessary files for production deployment
import fs from 'fs';
import path from 'path';

const filesToRemove = [
  // Test files
  'test-decodo-formats.js',
  'test-decodo-proxy.js',
  'test-email.js',
  'test-enhanced-email.js',
  'test-static-ip.js',
  'test-whitelisted-ip.js',
  'debug-decodo-proxy.js',
  
  // Fix/cleanup files (one-time use)
  'clean-fix.js',
  'cleanup-production.js',
  'enhance-data-quality.js',
  'enhance-email-with-city-data.js',
  'enhanced-email-service.js',
  'enhanced-retry-system.js',
  'fix-detection-bug.js',
  'fix-duplicate-import.js',
  'fix-duplicate-line.js',
  'fix-nodemailer.js',
  'fix-syntax-error.js',
  'fix-table-switching.js',
  'patch-table-switching.js',
  'patch-table-switching.mjs',
  'replace-retry-function.js',
  'safe-error-fix.js',
  'update-exports.js',
  'update-zillow-env.js',
  
  // Documentation files (keep README.md)
  'DECODO-DEPLOYMENT-GUIDE.md',
  'DEPLOYMENT-READY.md',
  'DEPLOYMENT.md',
  'REGIONAL-GUIDE.md',
  'env-template.txt',
  
  // Deploy script (not needed for Render)
  'deploy.sh',
  
  // Cleanup script itself
  'cleanup-for-production.js'
];

console.log('🧹 Cleaning up files for production deployment...\n');

let removedCount = 0;
let errorCount = 0;

filesToRemove.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Removed: ${file}`);
      removedCount++;
    } else {
      console.log(`⚠️  Not found: ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error removing ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   ✅ Files removed: ${removedCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log(`\n🎯 Production-ready files remaining:`);

// List remaining important files
const importantFiles = [
  'package.json',
  'package-lock.json',
  'render.yaml',
  'zillow.js',
  'proxies.js',
  'emailService.js',
  'utils.js',
  'detectSoldListings.js',
  'config/regions.js',
  'scripts/run-all-regions.js',
  'scripts/run-region.js',
  'scripts/run-region-first-time.js',
  'scripts/list-regions.js',
  'scripts/migrate-database.js',
  'scripts/retry-failed-cities.js',
  'scripts/recover-city.js',
  'README.md'
];

importantFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ Missing: ${file}`);
  }
});

console.log('\n🚀 Ready for GitHub and Render deployment!');
