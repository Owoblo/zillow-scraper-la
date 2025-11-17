# Deployment Guide for California Zillow Scraper

## Overview
This scraper monitors real estate listings in California (Bay Area, Los Angeles Area, and San Diego Area) and sends email notifications after each scrape.

## First Run Setup

### Step 1: Configure Environment Variables on Render

1. Go to your Render dashboard
2. Navigate to your cron job: `zillow-scraper-la-region`
3. Set the following environment variables:

**Required Variables:**
- `NODE_ENV` = `production`
- `FIRST_RUN` = `true` (for first run only)
- `EMAIL_USER` = Your Gmail address (e.g., `johnowolabi80@gmail.com`)
- `EMAIL_PASS` = Your Gmail app password
- `NOTIFICATION_EMAIL` = Email address to receive scrape reports
- `SMARTPROXY_USER` = (if using SmartProxy)
- `SMARTPROXY_PASS` = (if using SmartProxy)

### Step 2: Manual First Run

1. In Render dashboard, go to your cron job
2. Click "Manual Deploy" or use the "Run Now" button
3. This will:
   - Scrape all 18 California cities
   - Populate the `current_listings` table
   - **Skip detection** (no previous data to compare)
   - **Skip table switching** (will happen on next run)
   - Send email notification with all scraped cities

### Step 3: After First Run

1. **IMPORTANT**: Change `FIRST_RUN` environment variable to `false`
2. The cron job will now run automatically:
   - Daily at 8 AM EST (1 PM UTC)
   - Daily at 8 PM EST (1 AM UTC)
3. Subsequent runs will:
   - Compare current vs previous listings
   - Detect just-listed and sold properties
   - Switch tables automatically
   - Send detailed email reports

## Email Notifications

### What You'll Receive

After each scrape, you'll get an email with:

1. **Summary Statistics:**
   - Total listings scraped
   - Just-listed properties
   - Sold properties

2. **City-by-City Breakdown:**
   - Organized by region (Bay Area, Los Angeles Area, San Diego Area)
   - Each city shows:
     - Just-listed count
     - Sold count
     - Total listings

3. **Failed Cities:**
   - List of any cities that failed to scrape
   - Instructions to retry

### Email Configuration

The email service automatically:
- Groups cities by region
- Shows all 18 California cities
- Displays detection results (just-listed/sold)
- Includes retry instructions for failed cities

## Cities Being Monitored

### Bay Area (6 cities)
- San Francisco
- Santa Clara
- Fremont
- Daly City
- Concord
- San Mateo

### Los Angeles Area (5 cities)
- Los Angeles
- Glendale
- Pasadena
- Santa Clarita
- Burbank

### San Diego Area (7 cities)
- San Diego
- Poway
- Chula Vista
- Irvine
- Oceanside
- Escondido
- Santee

**Total: 18 cities across 3 regions**

## Cron Schedule

The scraper runs automatically:
- **8:00 AM EST** (1:00 PM UTC) - Morning scrape
- **8:00 PM EST** (1:00 AM UTC) - Evening scrape

A delayed retry runs 30 minutes after each main scrape to retry any failed cities.

## Troubleshooting

### First Run Issues

If the first run fails:
1. Check Render logs for errors
2. Verify all environment variables are set
3. Ensure proxy credentials are correct
4. Check database connection

### Email Not Sending

1. Verify `EMAIL_USER` and `EMAIL_PASS` are correct
2. Check Gmail app password is valid
3. Verify `NOTIFICATION_EMAIL` is set
4. Check Render logs for email errors

### Detection Not Working

- Detection only works after the first run
- Ensure `FIRST_RUN` is set to `false` after first run
- Check that `previous_listings` table has data

## Manual Commands

### Test Proxy
```bash
npm run test:proxy
```

### Run Scraper Manually
```bash
npm run enterprise
```

### Check Regions
```bash
node -e "import('./config/regions.js').then(m => console.log(Object.keys(m.REGIONS)))"
```

## Next Steps

1. ✅ Set `FIRST_RUN=true` in Render
2. ✅ Run manual first scrape
3. ✅ Verify email notification received
4. ✅ Change `FIRST_RUN=false` in Render
5. ✅ Let cron job run automatically

The system is now ready for production use!

