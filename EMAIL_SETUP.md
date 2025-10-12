# Email Notification Setup Guide

## Required Environment Variables

Add these to your `.env` file:

```bash
# Email Configuration for Notifications
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password_here
NOTIFICATION_EMAIL=your_notification_email@gmail.com
```

## Gmail Setup Instructions

### 1. Enable 2-Factor Authentication
- Go to your Google Account settings
- Enable 2-factor authentication if not already enabled

### 2. Generate App Password
- Go to Google Account → Security → App passwords
- Select "Mail" and "Other (custom name)"
- Enter "Zillow Scraper" as the name
- Copy the generated 16-character password

### 3. Use App Password
- Use the App Password (not your regular Gmail password) in `EMAIL_PASS`
- The App Password looks like: `abcd efgh ijkl mnop`

## Email Features

The enhanced system will send:

1. **Start Notification**: When scraping begins
2. **Completion Report**: Comprehensive HTML report with:
   - Performance metrics
   - Batch results
   - Error details
   - Success/failure status

## Example Email Report Includes:
- Total listings scraped
- Just-listed and sold properties detected
- Success rates and performance metrics
- Source breakdown (Decodo vs Realtor.com)
- Batch-by-batch results
- Error details (if any)

## Testing Email Setup

You can test the email configuration by running:
```bash
npm run enhanced:run
```

The system will send notifications at the start and completion of the scraping process.
