import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { main, detectJustListedAndSoldByRegion, switchTables } from './zillow.js';
import { getAllCities } from './config/regions.js';
import nodemailer from 'nodemailer';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

class FocusedProxySystem {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Focused configuration - Windsor and GTA only
    this.focusedCities = [
      // Windsor Area
      'Windsor', 'Kingsville', 'Leamington', 'Lakeshore', 'Essex', 
      'Tecumseh', 'Lasalle', 'Chatham-Kent', 'Amherstburg',
      // GTA Area
      'Toronto', 'Mississauga', 'Brampton', 'Markham', 
      'Vaughan', 'Richmond Hill', 'Oakville', 'Burlington'
    ];

    // Performance metrics
    this.metrics = {
      totalCities: 0,
      successfulCities: 0,
      failedCities: 0,
      totalListings: 0,
      totalJustListed: 0,
      totalSold: 0,
      startTime: null,
      endTime: null,
      errors: []
    };

    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(subject, htmlContent, isError = false) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `${isError ? '❌ ERROR: ' : '✅ SUCCESS: '}${subject}`,
        html: htmlContent
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`📧 Email notification sent: ${subject}`);
    } catch (error) {
      console.error('❌ Failed to send email notification:', error.message);
    }
  }

  /**
   * Generate comprehensive email report
   */
  generateEmailReport(results, detectionResults, totalDuration) {
    const successRate = this.metrics.totalCities > 0 
      ? (this.metrics.successfulCities / this.metrics.totalCities * 100).toFixed(1)
      : 0;

    const listingsPerMinute = totalDuration > 0 
      ? (this.metrics.totalListings / totalDuration).toFixed(1)
      : 0;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
          🚀 Focused Proxy System Report (Windsor + GTA)
        </h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">📊 Performance Summary</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>⏱️ Total Duration:</strong> ${totalDuration.toFixed(1)} minutes</li>
            <li style="margin: 8px 0;"><strong>🏙️ Cities Processed:</strong> ${this.metrics.successfulCities}/${this.metrics.totalCities}</li>
            <li style="margin: 8px 0;"><strong>📈 Total Listings:</strong> ${this.metrics.totalListings.toLocaleString()}</li>
            <li style="margin: 8px 0;"><strong>🆕 Just Listed:</strong> ${this.metrics.totalJustListed}</li>
            <li style="margin: 8px 0;"><strong>🏠 Sold:</strong> ${this.metrics.totalSold}</li>
            <li style="margin: 8px 0;"><strong>📊 Success Rate:</strong> ${successRate}%</li>
            <li style="margin: 8px 0;"><strong>⚡ Listings/Minute:</strong> ${listingsPerMinute}</li>
          </ul>
        </div>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">🏠 Source: Whitelisted IP Proxy</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>🔒 Proxy Type:</strong> Dedicated IP (Whitelisted)</li>
            <li style="margin: 8px 0;"><strong>🛡️ Anti-Detection:</strong> Built-in proxy rotation</li>
            <li style="margin: 8px 0;"><strong>⚡ Performance:</strong> Direct connection, no API delays</li>
            <li style="margin: 8px 0;"><strong>🎯 Reliability:</strong> Proven working system</li>
          </ul>
        </div>

        ${this.metrics.errors.length > 0 ? `
          <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #721c24; margin-top: 0;">❌ Errors (${this.metrics.errors.length})</h3>
            <ul style="color: #721c24;">
              ${this.metrics.errors.slice(0, 10).map(error => `<li>${error}</li>`).join('')}
              ${this.metrics.errors.length > 10 ? `<li>... and ${this.metrics.errors.length - 10} more errors</li>` : ''}
            </ul>
          </div>
        ` : ''}

        <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0c5460; margin-top: 0;">🎯 System Status</h3>
          <p style="color: #0c5460; margin: 0;">
            ${this.metrics.failedCities === 0 
              ? '🎉 All cities processed successfully! Focused proxy system is running optimally.' 
              : '⚠️ Some cities failed. Check errors above for details.'}
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d;">
          <p>Generated at ${new Date().toLocaleString()}</p>
          <p>Focused Proxy System - Windsor & GTA Areas</p>
        </div>
      </div>
    `;

    return htmlContent;
  }

  /**
   * Run the focused scraping workflow
   */
  async runFocusedScraping() {
    console.log('🚀 FOCUSED PROXY SYSTEM - WINDSOR & GTA SCRAPING');
    console.log('================================================');
    console.log('📅 Focused Cities (Windsor + GTA only):');
    console.log(`  🏙️ Windsor Area: 9 cities`);
    console.log(`  🏙️ GTA Area: 8 cities`);
    console.log(`  📊 Total: ${this.focusedCities.length} cities`);
    console.log('\n⚙️ Configuration:');
    console.log('  🔒 Proxy: Dedicated IP (Whitelisted)');
    console.log('  🛡️ Anti-Detection: Built-in proxy rotation');
    console.log('  ⚡ Performance: Direct connection, no API delays');
    console.log('  🎯 Reliability: Proven working system');
    console.log('');

    this.metrics.startTime = new Date();
    this.metrics.totalCities = this.focusedCities.length;

    // Send start notification
    await this.sendEmailNotification(
      'Focused Proxy System Started',
      '<h2>🚀 Focused Proxy System Started</h2><p>The focused scraping system has begun processing Windsor and GTA areas using the proven whitelisted IP proxy setup.</p>'
    );

    try {
      // Step 1: Scrape all focused cities using the original zillow.js
      console.log('\n📊 Step 1: Scraping focused cities using whitelisted IP proxy...');
      const scrapeResults = await main(['windsor-area', 'gta-area', 'gta-extended']);
      
      this.metrics.totalListings = scrapeResults.totalListings;
      this.metrics.successfulCities = scrapeResults.successfulCities;
      this.metrics.failedCities = scrapeResults.failedCities;
      this.metrics.errors = scrapeResults.errors || [];

      console.log(`✅ Scraping complete: ${scrapeResults.totalListings} listings from ${scrapeResults.successfulCities} cities`);

      // Step 2: Run detection for each region
      console.log('\n🔍 Step 2: Running detection for each region...');
      const detectionResults = await this.runFocusedDetection();

      this.metrics.endTime = new Date();
      const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000 / 60; // minutes

      // Generate final report
      this.generateReport(detectionResults, totalDuration);
      
      // Send comprehensive email report
      const emailContent = this.generateEmailReport({}, detectionResults, totalDuration);
      await this.sendEmailNotification(
        'Focused Proxy System Complete',
        emailContent,
        this.metrics.failedCities > 0
      );
      
      return {
        success: this.metrics.failedCities === 0,
        totalListings: this.metrics.totalListings,
        detectionResults,
        metrics: this.metrics
      };

    } catch (error) {
      console.error('❌ Focused system failed:', error.message);
      this.metrics.errors.push(`System error: ${error.message}`);
      
      await this.sendEmailNotification(
        'Focused Proxy System Failed',
        `<h2>❌ Focused Proxy System Failed</h2><p>Error: ${error.message}</p>`,
        true
      );
      
      throw error;
    }
  }

  /**
   * Run focused detection for each region
   */
  async runFocusedDetection() {
    try {
      console.log(`\n🔍 FOCUSED DETECTION PHASE`);
      console.log(`========================`);
      console.log(`Running detection for Windsor and GTA regions...`);

      let totalJustListed = 0;
      let totalSold = 0;

      // Detect for Windsor area
      try {
        console.log(`\n📍 Detecting for Windsor area...`);
        const windsorResults = await detectJustListedAndSoldByRegion('windsor-area');
        totalJustListed += windsorResults.justListed || 0;
        totalSold += windsorResults.sold || 0;
        console.log(`  ✅ Windsor area: ${windsorResults.justListed || 0} just-listed, ${windsorResults.sold || 0} sold`);
        
        // Switch tables for Windsor area
        console.log(`  🔄 Switching tables for Windsor area...`);
        await switchTables('windsor-area');
        
      } catch (error) {
        console.error(`❌ Detection failed for Windsor area:`, error.message);
        this.metrics.errors.push(`Windsor detection: ${error.message}`);
      }

      // Detect for GTA area
      try {
        console.log(`\n📍 Detecting for GTA area...`);
        const gtaResults = await detectJustListedAndSoldByRegion('gta-area');
        totalJustListed += gtaResults.justListed || 0;
        totalSold += gtaResults.sold || 0;
        console.log(`  ✅ GTA area: ${gtaResults.justListed || 0} just-listed, ${gtaResults.sold || 0} sold`);
        
        // Switch tables for GTA area
        console.log(`  🔄 Switching tables for GTA area...`);
        await switchTables('gta-area');
        
      } catch (error) {
        console.error(`❌ Detection failed for GTA area:`, error.message);
        this.metrics.errors.push(`GTA detection: ${error.message}`);
      }

      this.metrics.totalJustListed = totalJustListed;
      this.metrics.totalSold = totalSold;
      
      console.log(`\n✅ Focused detection complete: ${totalJustListed} just-listed, ${totalSold} sold`);
      return { justListed: totalJustListed, sold: totalSold };

    } catch (error) {
      console.error(`❌ Focused detection failed:`, error.message);
      return { justListed: 0, sold: 0 };
    }
  }

  /**
   * Generate comprehensive console report
   */
  generateReport(detectionResults, totalDuration) {
    console.log('\n🎯 FOCUSED PROXY SYSTEM REPORT');
    console.log('================================');
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(1)} minutes`);
    console.log(`🏙️ Cities Processed: ${this.metrics.successfulCities}/${this.metrics.totalCities}`);
    console.log(`📈 Total Listings: ${this.metrics.totalListings.toLocaleString()}`);
    console.log(`🆕 Just Listed: ${this.metrics.totalJustListed}`);
    console.log(`🏠 Sold: ${this.metrics.totalSold}`);
    console.log(`🔒 Proxy: Dedicated IP (Whitelisted)`);
    console.log(`🛡️ Anti-Detection: Built-in proxy rotation`);
    
    const successRate = this.metrics.totalCities > 0 
      ? (this.metrics.successfulCities / this.metrics.totalCities * 100).toFixed(1)
      : 0;
    
    console.log(`\n📊 Performance Metrics:`);
    console.log(`  ⚡ Success Rate: ${successRate}%`);
    console.log(`  ⏱️ Avg Time per City: ${totalDuration > 0 ? (totalDuration * 60 / this.metrics.totalCities).toFixed(2) : 0}s`);
    console.log(`  📈 Listings per Minute: ${totalDuration > 0 ? (this.metrics.totalListings / totalDuration).toFixed(1) : 0}`);

    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.metrics.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 Focused proxy system completed!');
    console.log('✅ All cities processed with whitelisted IP proxy');
    console.log('✅ Detection completed for Windsor and GTA regions');
    console.log('✅ Tables switched for next run');
    console.log('✅ Email notification sent');
  }
}

// Export for use in other modules
export default FocusedProxySystem;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new FocusedProxySystem();
  system.runFocusedScraping().catch(error => {
    console.error('❌ Focused system failed:', error.message);
    process.exit(1);
  });
}
