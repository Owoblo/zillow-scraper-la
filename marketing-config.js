// Marketing email configuration
export const MARKETING_CONFIG = {
  // Minimum number of properties to trigger marketing email
  MIN_PROPERTIES: 3,
  
  // Maximum number of properties to show in email
  MAX_PROPERTIES_SHOWN: 5,
  
  // Email templates
  TEMPLATES: {
    SUBJECT: {
      JUST_LISTED: "🏠 {count} New Properties Just Listed in {city}!",
      JUST_SOLD: "🚚 {count} Houses Just Sold in {city} - Movers Needed!",
      MIXED: "🏠 {count} Properties Just Listed/Sold in {city}!"
    }
  },
  
  // Official email configuration
  OFFICIAL_EMAIL: "listings@sold2move.com",
  
  // App URLs (replace with your actual URLs)
  APP_URLS: {
    SIGNUP: "https://sold2move.com/signup",
    DEMO: "https://cal.com/john-owolabi-0rcb1z/sold2move-demo", // Your actual Cal.com booking link
    UNSUBSCRIBE: "https://sold2move.com/unsubscribe",
    PRIVACY: "https://sold2move.com/privacy"
  },
  
  // UTM parameters for tracking
  UTM_PARAMS: {
    SOURCE: "email",
    CAMPAIGN: "real_estate_alert",
    MEDIUM: "automated"
  }
};

// Default marketing email list (you can expand this)
export const DEFAULT_MARKETING_EMAILS = [
  'business@starmovers.ca',
  'johnowolabi80@gmail.com',
  'info@rentason.ca',
  'mississauga@letsgetmoving.ca',
  'a1moversthatcare@hotmail.com',
  'sales@amjmove.com',
  'move@armmove.com',
  'info@mmovers.ca',
  'move@getmovers.ca',
  'info@kingswayvanlines.com',
  'info@richmondhillmovers.com',
  'burlington@canadamoving.com',
  'gtamoversontario@gmail.com',
  'info@movingcompanybrampton.ca',
  'info@oakvillemovingandstorage.com',
  'info@torontoumoving.com',
  'MoveMe@MyNinjaMovers.com'
];

// Get marketing email list from environment or use default
export function getMarketingEmailList() {
  const envEmails = process.env.MARKETING_EMAIL_LIST;
  if (envEmails) {
    return envEmails.split(',').map(email => email.trim());
  }
  return DEFAULT_MARKETING_EMAILS;
}
