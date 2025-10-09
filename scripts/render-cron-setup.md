# Render Cron Job Setup for Delayed Retry System

## Overview
This setup creates two cron jobs on Render:
1. **Main Scrape**: Runs daily at 8:00 AM EST and 8:00 PM EST (12-hour intervals)
2. **Delayed Retry**: Runs daily at 8:30 AM EST and 8:30 PM EST (30 minutes after each main scrape)

## How It Works

### 1. Main Scrape (8:00 AM EST & 8:00 PM EST)
- Runs `npm run scrape:all`
- Scrapes all regions
- Runs initial detection
- If cities fail, they get retried automatically within the main script

### 2. Delayed Retry (8:30 AM EST & 8:30 PM EST)
- Runs `npm run delayed:retry`
- Checks if there are still failed cities after initial retries
- **IF** there are still failed cities → retries only those specific cities
- **ELSE** → does nothing (no unnecessary requests to Zillow)

## Setup Instructions

### Option 1: Using render.yaml (Recommended)
1. Deploy your app to Render
2. The `render.yaml` file will automatically create both cron jobs
3. No additional setup needed

### Option 2: Manual Setup
1. Go to your Render dashboard
2. Create a new Cron Job
3. Set the following:

**Main Scrape Cron:**
- Name: `zillow-scraper-main`
- Schedule: `0 13,1 * * *` (8:00 AM EST and 8:00 PM EST daily)
- Build Command: `npm install`
- Start Command: `npm run scrape:all`

**Delayed Retry Cron:**
- Name: `zillow-scraper-delayed-retry`
- Schedule: `30 13,1 * * *` (8:30 AM EST and 8:30 PM EST daily)
- Build Command: `npm install`
- Start Command: `npm run delayed:retry`

## Environment Variables
Make sure to set these in Render:
- `SMARTPROXY_USER`
- `SMARTPROXY_PASS`
- `NODE_ENV=production`

## Benefits
- ✅ 30-minute delay prevents Zillow blocking
- ✅ Only retries cities that actually failed
- ✅ No unnecessary requests if all cities succeed
- ✅ Automatic detection and table switching
- ✅ Complete workflow without manual intervention

## Monitoring
- Check Render logs for both cron jobs
- Monitor `delayed-retry.log` for delayed retry progress
- Database will show just-listed and sold properties

## Testing
To test locally:
```bash
# Test main scrape
npm run scrape:all

# Test delayed retry (after 30 minutes)
npm run delayed:retry

# Or test immediately
npm run schedule:delayed
```
