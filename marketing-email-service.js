// Marketing email service for automated lead generation
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { MARKETING_CONFIG, getMarketingEmailList, getLocationBasedEmails } from './marketing-config.js';

// Load environment variables
dotenv.config();

// Marketing email configuration
const EMAIL_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SOLD2MOVE_EMAIL_USER || process.env.EMAIL_USER,
    pass: process.env.SOLD2MOVE_EMAIL_PASS || process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
};

// Create marketing transporter
function createMarketingTransporter() {
  return nodemailer.createTransport(EMAIL_CONFIG);
}

// Get top properties for marketing email
function getTopProperties(listings, count = 5) {
  return listings
    .filter(listing => listing.price && listing.price !== 'N/A')
    .sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
      const priceB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
      return priceB - priceA; // Sort by price descending
    })
    .slice(0, count);
}

// Generate marketing email template
function generateMarketingTemplate(city, justListed, soldListings, topProperties) {
  const totalActivity = justListed + soldListings.length;
  const timeAgo = '12 hours ago'; // You can make this dynamic
  
  // Get URLs from config
  const signupUrl = `${MARKETING_CONFIG.APP_URLS.SIGNUP}?utm_source=${MARKETING_CONFIG.UTM_PARAMS.SOURCE}&utm_campaign=${MARKETING_CONFIG.UTM_PARAMS.CAMPAIGN}&utm_medium=${MARKETING_CONFIG.UTM_PARAMS.MEDIUM}`;
  const demoUrl = `${MARKETING_CONFIG.APP_URLS.DEMO}?utm_source=${MARKETING_CONFIG.UTM_PARAMS.SOURCE}&utm_campaign=${MARKETING_CONFIG.UTM_PARAMS.CAMPAIGN}&utm_medium=${MARKETING_CONFIG.UTM_PARAMS.MEDIUM}`;
  const unsubscribeUrl = MARKETING_CONFIG.APP_URLS.UNSUBSCRIBE;
  const privacyUrl = MARKETING_CONFIG.APP_URLS.PRIVACY;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 30px; }
        .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .stat-number { font-size: 36px; font-weight: bold; color: #28a745; }
        .stat-label { font-size: 18px; color: #666; }
        .property-card { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .property-address { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
        .property-price { font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 5px; }
        .property-details { color: #666; font-size: 14px; }
        .cta-section { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; padding: 15px 30px; margin: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-radius: 0 0 8px 8px; }
        .urgency { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚚 Sold2Move - Movers Needed Alert</h1>
          <p>New Moving Opportunities in ${city}</p>
          <p style="font-size: 14px; margin-top: 10px;">From: Sold2Move Team</p>
        </div>
        
        <div class="content">
          <div class="stats">
            <div class="stat-number">${totalActivity}</div>
            <div class="stat-label">Houses Just Sold in ${city} - Movers Needed!</div>
            <p style="margin: 10px 0 0 0; color: #666;">${timeAgo}</p>
          </div>
          
          <div class="urgency">
            <strong>🚚 Moving Opportunities Available!</strong><br>
            These families just sold their homes and need professional movers. Get connected now!
          </div>
          
          <h3>🏠 Recent Sales - Moving Opportunities:</h3>
          
          ${topProperties.map(property => `
            <div class="property-card">
              <div class="property-address">${property.address || 'Address Not Available'}</div>
              <div class="property-price">💰 ${property.price || 'Price Not Available'}</div>
              <div class="property-details">
                ${property.beds ? `🛏️ ${property.beds} beds` : ''} 
                ${property.baths ? `🛁 ${property.baths} baths` : ''} 
                ${property.area ? `📐 ${property.area} sqft` : ''}
              </div>
            </div>
          `).join('')}
          
          <div class="cta-section">
            <h3>🎯 Get Connected to These Moving Opportunities!</h3>
            <p>Join Sold2Move and get <strong>200 FREE credits + 1 month FREE access</strong> to connect with families who need movers</p>
            <a href="${signupUrl}" class="btn btn-primary">
              🚚 Get 200 FREE Credits + 1 Month FREE
            </a>
            <a href="${demoUrl}" class="btn btn-secondary">
              📅 Book a Demo
            </a>
          </div>
          
          <div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4>💡 Why Join Sold2Move:</h4>
            <ul>
              <li>✅ Get notified within minutes of new sales</li>
              <li>✅ Connect directly with families who need movers</li>
              <li>✅ Access to exclusive moving opportunities</li>
              <li>✅ 200 FREE credits + 1 month FREE access</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>This email was sent because you expressed interest in real estate opportunities in ${city}.</p>
          <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${privacyUrl}">Privacy Policy</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send marketing email to bulk list
export async function sendMarketingEmail(city, justListed, soldListings) {
  try {
    // Only send if there's significant activity
    const totalActivity = justListed + soldListings.length;
    if (totalActivity < MARKETING_CONFIG.MIN_PROPERTIES) {
      console.log(`📧 Skipping marketing email for ${city}: Only ${totalActivity} properties (minimum ${MARKETING_CONFIG.MIN_PROPERTIES} required)`);
      return;
    }

    console.log(`📧 Preparing marketing email for ${city}: ${justListed} just-listed, ${soldListings.length} sold`);
    
    const topProperties = getTopProperties(soldListings, MARKETING_CONFIG.MAX_PROPERTIES_SHOWN);
    const emailContent = generateMarketingTemplate(city, justListed, soldListings, topProperties);
    
    const transporter = createMarketingTransporter();
    const marketingEmails = getLocationBasedEmails(city); // Use location-based targeting
    
    console.log(`🎯 Location-based targeting for ${city}: ${marketingEmails.length} emails`);
    let successCount = 0;
    let failureCount = 0;
    
    // Send to each email in the bulk list
    for (const email of marketingEmails) {
      try {
        // Generate subject based on activity type
        let subject;
        if (justListed > 0 && soldListings.length > 0) {
          subject = `🏠 ${totalActivity} Properties Just Listed/Sold in ${city}!`;
        } else if (justListed > 0) {
          subject = `🏠 ${justListed} New Properties Just Listed in ${city}!`;
        } else {
          subject = `🚚 ${soldListings.length} Houses Just Sold in ${city} - Movers Needed!`;
        }
        
        const mailOptions = {
          from: `"Sold2Move Team" <${EMAIL_CONFIG.auth.user}>`, // Use authenticated user
          to: email,
          subject: subject,
          html: emailContent
        };
        
        await transporter.sendMail(mailOptions);
        successCount++;
        console.log(`✅ Marketing email sent to: ${email}`);
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        failureCount++;
        console.error(`❌ Failed to send marketing email to ${email}:`, error.message);
      }
    }
    
    console.log(`📧 Marketing email summary: ${successCount} sent, ${failureCount} failed`);
    
  } catch (error) {
    console.error('❌ Marketing email system error:', error.message);
  }
}

// Export for use in main system
export default { sendMarketingEmail };
