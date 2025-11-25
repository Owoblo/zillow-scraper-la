#!/usr/bin/env node

/**
 * Manual Chrome installation script for Puppeteer
 * Run this if Chrome is not found: node install-chrome.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 Checking Chrome installation for Puppeteer...');

// Check cache directory
const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(process.env.HOME || '/opt/render', '.cache', 'puppeteer');
console.log(`📁 Cache directory: ${cacheDir}`);

try {
  // Create cache directory if it doesn't exist
  if (!fs.existsSync(cacheDir)) {
    console.log('📁 Creating cache directory...');
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Try to install Chrome
  console.log('📦 Installing Chrome for Puppeteer...');
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir
    }
  });

  console.log('✅ Chrome installed successfully!');

  // List installed browsers
  console.log('\n📋 Installed browsers:');
  try {
    execSync('npx puppeteer browsers list', { stdio: 'inherit' });
  } catch (e) {
    console.log('Could not list browsers');
  }

} catch (error) {
  console.error('❌ Chrome installation failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('1. Check if you have write permissions to:', cacheDir);
  console.error('2. Make sure you have enough disk space');
  console.error('3. Try setting PUPPETEER_CACHE_DIR environment variable');
  process.exit(1);
}
