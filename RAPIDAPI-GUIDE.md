# RapidAPI Scraper Guide

## ✅ Integration Complete!

Your new RapidAPI-based scraper is ready to use! No more proxies, no more bot detection, no more headaches!

## 🚀 Quick Start

### Test Single City
```bash
npm run rapid:city "Miami, FL"
# or
node rapidapi-scraper.js city "Austin, TX"
```

### Scrape One Region
```bash
npm run rapid:region bay-area
# or
node rapidapi-scraper.js region texas-major-cities
```

### Scrape ALL Regions (Currently 16 regions, 150+ cities!)
```bash
npm run rapid:all
# or
node rapidapi-scraper.js all
```

## 📊 Current Coverage

- **16 Regions** across the United States
- **150+ Cities** including:
  - California (Bay Area, LA, San Diego, Sacramento, Orange County, Riverside, Fresno)
  - Texas (Houston, Dallas, Austin, San Antonio, Fort Worth, El Paso, etc.)
  - Florida (Miami, Tampa, Orlando, Jacksonville, etc.)
  - New York (NYC, Brooklyn, Queens, Buffalo, Rochester, etc.)
  - Washington (Seattle, Spokane, Tacoma, etc.)
  - Arizona, Colorado, Georgia, Nevada, North Carolina

## 🎯 Adding More Cities

### Super Easy - Just Edit One File!

Open `config/regions-rapidapi.js` and add cities to existing regions:

```javascript
'california-central-coast': {
  name: 'California Central Coast',
  cities: [
    { name: "Santa Barbara", state: "CA" },
    { name: "San Luis Obispo", state: "CA" },
    { name: "Monterey", state: "CA" },
    { name: "Salinas", state: "CA" },
  ]
},
```

### Add a New Region

```javascript
'midwest-cities': {
  name: 'Midwest Major Cities',
  cities: [
    { name: "Chicago", state: "IL" },
    { name: "Detroit", state: "MI" },
    { name: "Minneapolis", state: "MN" },
    { name: "Kansas City", state: "MO" },
    { name: "Milwaukee", state: "WI" },
  ]
},
```

That's it! Just city name and state abbreviation. The API handles everything else.

## 📋 How It Works

1. **Fetches from RapidAPI** - Clean, reliable data with no bot detection
2. **Maps to Your Schema** - Automatically converts to your existing database structure
3. **Upserts to Supabase** - Saves to `current_listings` table
4. **Sends Email Notifications** - Uses your existing email system
5. **Tracks Everything** - Run IDs, timestamps, regions, etc.

## 💰 API Usage

- **41 listings per page**
- **Max 20 pages per city** (configurable in `rapidapi-scraper.js`)
- Average city = 500-1000 listings
- Large city (SF, LA, NYC) = 800+ listings

## 🔧 Configuration

Edit `rapidapi-scraper.js` to adjust:

```javascript
const MAX_PAGES_PER_CITY = 20;     // Max pages to fetch per city
const PAGE_DELAY_MS = 1000;        // Delay between pages (ms)
const UPSERT_BATCH_SIZE = 200;     // Database batch size
```

## 📦 What's Included

### Files Created:
- `rapidapi-scraper.js` - Main scraper using RapidAPI
- `config/regions-rapidapi.js` - Simplified city configuration
- `test-rapidapi.js` - API testing script
- `RAPIDAPI-GUIDE.md` - This guide

### Files You Can Remove (if you want):
- `proxies.js` - No longer needed
- Old Puppeteer/ScraperAPI code - No longer needed

## 🎉 Benefits

### Before (ScraperAPI/Puppeteer):
- ❌ Complex proxy management
- ❌ Bot detection issues
- ❌ Headless browser overhead
- ❌ Complicated map bounds/region IDs
- ❌ Slow and unreliable

### After (RapidAPI):
- ✅ Simple fetch requests
- ✅ No bot detection
- ✅ No proxies needed
- ✅ Just city name + state
- ✅ Fast and reliable
- ✅ Easy to add new cities

## 🔑 API Key

Your RapidAPI key is currently hardcoded in `rapidapi-scraper.js`.

**Better practice:** Add to `.env` file:
```bash
RAPIDAPI_KEY=your_key_here
```

Then update `rapidapi-scraper.js`:
```javascript
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
```

## 📈 Next Steps

1. **Test with a single city** to verify everything works
2. **Add more cities** to `regions-rapidapi.js`
3. **Run a region** to see the full flow
4. **Schedule regular scrapes** with cron or your existing scheduler
5. **Monitor your API usage** on RapidAPI dashboard

## 🆘 Troubleshooting

### API Error 429 (Rate Limit)
- Check your RapidAPI subscription limits
- Increase `PAGE_DELAY_MS` in the scraper

### Database Errors
- Verify Supabase credentials
- Check table permissions
- Review column names match schema

### Missing Data
- Some listings may not have all fields
- The mapper handles null values gracefully
- Check `test-rapidapi-response.json` to see raw data

## 💡 Pro Tips

1. **Start small** - Test with one city before running all regions
2. **Monitor costs** - Keep track of your RapidAPI usage
3. **Use regions strategically** - Focus on high-value areas first
4. **Schedule wisely** - Run during off-peak hours to avoid rate limits
5. **Keep it simple** - Just add city + state, no complex coordinates

---

**Questions?** Check the code comments in `rapidapi-scraper.js` for detailed explanations.

**Ready to scale?** Just keep adding cities to `regions-rapidapi.js`!
