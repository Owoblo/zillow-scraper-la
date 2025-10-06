// Enhanced emailService.js with city-by-city details
import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  // Using Gmail SMTP (you can change this to any SMTP provider)
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'johnowolabi80@gmail.com', // Your Gmail address
    pass: process.env.EMAIL_PASS || 'yrpq rvwj ozhb mcdi'  // Your Gmail app password
  }
};

// Alternative: Using SendGrid (recommended for production)
const SENDGRID_CONFIG = {
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
};

// Create transporter
function createTransporter() {
  if (process.env.SENDGRID_API_KEY) {
    console.log('📧 Using SendGrid for email notifications');
    return nodemailer.createTransport(SENDGRID_CONFIG);
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 Using Gmail for email notifications');
    return nodemailer.createTransport(EMAIL_CONFIG);
  } else {
    console.log('⚠️  No email configuration found - notifications disabled');
    return null;
  }
}

/**
 * Send email notification about scrape results with city-by-city details
 */
export async function sendScrapeNotification(results) {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('📧 Email notifications disabled - no email config found');
    return;
  }

  const {
    success,
    error,
    totalListings,
    justListed,
    soldListings,
    verificationResults,
    regionalResults,
    runDuration,
    timestamp,
    cityDetails = [] // New: city-by-city breakdown
  } = results;

  // Determine email subject
  const subject = success 
    ? `✅ Zillow Scraper Success - ${totalListings} listings (${justListed} just-listed, ${soldListings} sold)`
    : `❌ Zillow Scraper Failed - ${error}`;

  // Create HTML email content
  const htmlContent = createEmailHTML(results);
  
  // Create text email content
  const textContent = createEmailText(results);

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@zillow-scraper.com',
    to: process.env.NOTIFICATION_EMAIL,
    subject: subject,
    text: textContent,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email notification sent:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send email notification:', error.message);
  }
}

/**
 * Create HTML email content with city-by-city details
 */
function createEmailHTML(results) {
  const {
    success,
    error,
    totalListings,
    justListed,
    soldListings,
    verificationResults,
    regionalResults,
    runDuration,
    timestamp,
    cityDetails = []
  } = results;

  const statusColor = success ? '#28a745' : '#dc3545';
  const statusIcon = success ? '✅' : '❌';
  const statusText = success ? 'SUCCESS' : 'FAILED';

  // Group cities by region
  const citiesByRegion = {};
  cityDetails.forEach(city => {
    if (!citiesByRegion[city.region]) {
      citiesByRegion[city.region] = [];
    }
    citiesByRegion[city.region].push(city);
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid ${statusColor}; }
        .stat-number { font-size: 24px; font-weight: bold; color: ${statusColor}; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
        .error-box { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .success-box { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
        .verification-details { margin-top: 15px; }
        .verification-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .verification-item:last-child { border-bottom: none; }
        .city-details { margin-top: 20px; }
        .region-section { margin-bottom: 25px; }
        .region-header { background: #e9ecef; padding: 10px 15px; border-radius: 6px; font-weight: bold; color: #495057; margin-bottom: 10px; }
        .city-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .city-card { background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 3px solid #007bff; }
        .city-name { font-weight: bold; color: #495057; margin-bottom: 5px; }
        .city-stats { display: flex; justify-content: space-between; font-size: 14px; }
        .just-listed { color: #28a745; font-weight: bold; }
        .sold { color: #dc3545; font-weight: bold; }
        .total { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusIcon} Zillow Scraper Report</h1>
          <p>${statusText} - ${timestamp}</p>
        </div>
        
        <div class="content">
          ${success ? `
            <div class="success-box">
              <strong>🎉 Scrape completed successfully!</strong><br>
              Duration: ${runDuration}
            </div>
          ` : `
            <div class="error-box">
              <strong>💥 Scrape failed!</strong><br>
              Error: ${error}
            </div>
          `}

          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${totalListings || 0}</div>
              <div class="stat-label">Total Listings</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${justListed || 0}</div>
              <div class="stat-label">Just Listed</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${soldListings || 0}</div>
              <div class="stat-label">Sold Listings</div>
            </div>
          </div>

          ${cityDetails.length > 0 ? `
            <div class="city-details">
              <h3>🏙️ City-by-City Breakdown</h3>
              ${Object.entries(citiesByRegion).map(([region, cities]) => `
                <div class="region-section">
                  <div class="region-header">${region.replace('-', ' ').toUpperCase()}</div>
                  <div class="city-grid">
                    ${cities.map(city => `
                      <div class="city-card">
                        <div class="city-name">${city.name}</div>
                        <div class="city-stats">
                          <span class="just-listed">📈 ${city.justListed || 0} just-listed</span>
                          <span class="sold">🏠 ${city.sold || 0} sold</span>
                        </div>
                        <div class="city-stats">
                          <span class="total">📊 ${city.total || 0} total</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${verificationResults ? `
            <h3>🔍 Verification Results</h3>
            <div class="verification-details">
              <div class="verification-item">
                <span>Verified Sold:</span>
                <strong>${verificationResults.verifiedSold || 0}</strong>
              </div>
              <div class="verification-item">
                <span>Moved Back to Active:</span>
                <strong>${verificationResults.movedBackToActive || 0}</strong>
              </div>
              <div class="verification-item">
                <span>Inconclusive:</span>
                <strong>${verificationResults.inconclusive || 0}</strong>
              </div>
            </div>
          ` : ''}

          ${regionalResults && Object.keys(regionalResults).length > 0 ? `
            <h3>📊 Regional Summary</h3>
            <div class="verification-details">
              ${Object.entries(regionalResults).map(([region, data]) => `
                <div class="verification-item">
                  <span>${region}:</span>
                  <strong>${data.listings} listings from ${data.cities} cities</strong>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <p><strong>Next run:</strong> ${new Date(Date.now() + 12 * 60 * 60 * 1000).toLocaleString()}</p>
        </div>
        
        <div class="footer">
          <p>Zillow Scraper - Automated Real Estate Monitoring</p>
          <p>This is an automated report from your scheduled scraper.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Create text email content with city-by-city details
 */
function createEmailText(results) {
  const {
    success,
    error,
    totalListings,
    justListed,
    soldListings,
    verificationResults,
    regionalResults,
    runDuration,
    timestamp,
    cityDetails = []
  } = results;

  let text = `ZILLOW SCRAPER REPORT\n`;
  text += `========================\n\n`;
  text += `Status: ${success ? 'SUCCESS' : 'FAILED'}\n`;
  text += `Time: ${timestamp}\n`;
  text += `Duration: ${runDuration}\n\n`;

  if (success) {
    text += `RESULTS:\n`;
    text += `- Total Listings: ${totalListings || 0}\n`;
    text += `- Just Listed: ${justListed || 0}\n`;
    text += `- Sold Listings: ${soldListings || 0}\n\n`;

    if (cityDetails.length > 0) {
      text += `CITY-BY-CITY BREAKDOWN:\n`;
      text += `========================\n\n`;
      
      // Group cities by region
      const citiesByRegion = {};
      cityDetails.forEach(city => {
        if (!citiesByRegion[city.region]) {
          citiesByRegion[city.region] = [];
        }
        citiesByRegion[city.region].push(city);
      });

      Object.entries(citiesByRegion).forEach(([region, cities]) => {
        text += `${region.replace('-', ' ').toUpperCase()}:\n`;
        text += `${'='.repeat(region.length)}\n`;
        cities.forEach(city => {
          text += `  ${city.name}: ${city.justListed || 0} just-listed, ${city.sold || 0} sold (${city.total || 0} total)\n`;
        });
        text += `\n`;
      });
    }

    if (verificationResults) {
      text += `VERIFICATION RESULTS:\n`;
      text += `- Verified Sold: ${verificationResults.verifiedSold || 0}\n`;
      text += `- Moved Back to Active: ${verificationResults.movedBackToActive || 0}\n`;
      text += `- Inconclusive: ${verificationResults.inconclusive || 0}\n\n`;
    }

    if (regionalResults && Object.keys(regionalResults).length > 0) {
      text += `REGIONAL SUMMARY:\n`;
      Object.entries(regionalResults).forEach(([region, data]) => {
        text += `- ${region}: ${data.listings} listings from ${data.cities} cities\n`;
      });
      text += `\n`;
    }
  } else {
    text += `ERROR: ${error}\n\n`;
  }

  text += `Next run: ${new Date(Date.now() + 12 * 60 * 60 * 1000).toLocaleString()}\n\n`;
  text += `This is an automated report from your scheduled scraper.`;

  return text;
}
