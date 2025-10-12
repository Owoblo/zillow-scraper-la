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
      JUST_SOLD: "🏠 {count} Properties Just Sold in {city}!",
      MIXED: "🏠 {count} Properties Just Listed/Sold in {city}!"
    }
  },
  
  // Official email configuration
  OFFICIAL_EMAIL: "johnowolabi80@gmail.com",
  
  // App URLs (replace with your actual URLs)
  APP_URLS: {
    SIGNUP: "https://sold2move.com/signup",
    DEMO: "https://sold2move.com/demo",
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
  'lead1@example.com',
  'lead2@example.com',
  'lead3@example.com',
  // Add more emails here
];

// Get marketing email list from environment or use default
export function getMarketingEmailList() {
  const envEmails = process.env.MARKETING_EMAIL_LIST;
  if (envEmails) {
    return envEmails.split(',').map(email => email.trim());
  }
  return DEFAULT_MARKETING_EMAILS;
}
