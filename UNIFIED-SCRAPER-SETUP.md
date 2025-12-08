# Unified Scraper Setup Guide

## 🎯 What's New

**Single Table Design** - Replaced 4 tables with 1 unified table
- ✅ Automatic status tracking (just_listed, active, price_changed, sold)
- ✅ Comprehensive error handling and logging
- ✅ Scrape history tracking
- ✅ Works with both US and Canadian cities
- ✅ Safe for adding new cities (no conflicts)

---

## 📋 SETUP STEPS

### Step 1: Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**

1. Go to: https://supabase.com/dashboard/project/idbyrtwdeeruiutoukct/sql/new

2. Copy ALL the SQL from `migrations/create-unified-listings-table.sql`

3. Paste into the SQL Editor and click "Run"

4. Verify success - you should see:
   - ✅ `listings` table created
   - ✅ `scrape_logs` table created
   - ✅ `listing_status_history` table created
   - ✅ Indexes created

**Option B: Using psql (Advanced)**

```bash
psql postgresql://postgres:[password]@db.idbyrtwdeeruiutoukct.supabase.co:5432/postgres < migrations/create-unified-listings-table.sql
```

---

### Step 2: Verify Tables Created

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('listings', 'scrape_logs', 'listing_status_history');
```

Should return 3 rows.

---

### Step 3: Test with One City

```bash
node unified-scraper.js city "Oakland, CA"
```

**Expected Output:**
```
[timestamp] [Oakland] ℹ️  Starting scrape for Oakland, CA (USA)
[timestamp] [Oakland] ℹ️  Region: Test | Run ID: xxx-xxx-xxx
[timestamp] [Oakland] ℹ️  Fetching page 1...
[timestamp] [Oakland] ℹ️  Found 650 total listings across 16 pages
[timestamp] [Oakland] ℹ️  Fetching page 2...
...
[timestamp] [Oakland] ✅ Scrape complete in 25s
[timestamp] [Oakland] ℹ️  Summary: 650 new, 0 updated, 0 price changes, 0 sold
```

---

### Step 4: Verify Data in Supabase

```sql
-- Check listings were created
SELECT COUNT(*), status FROM listings GROUP BY status;

-- Should see something like:
-- just_listed: 650
-- active: 0
```

---

### Step 5: Test Second Scrape (Status Transitions)

Run the same city again:

```bash
node unified-scraper.js city "Oakland, CA"
```

**Expected:**
- Most listings move from `just_listed` → `active`
- New listings get `just_listed`
- Missing listings get `sold`
- Price changes get `price_changed`

Verify:

```sql
SELECT COUNT(*), status FROM listings WHERE lastcity = 'Oakland' GROUP BY status;
```

---

### Step 6: Test Adding New City

```bash
node unified-scraper.js city "Berkeley, CA"
```

**✅ This should NOT affect Oakland data**

Verify both cities exist:

```sql
SELECT lastcity, COUNT(*) FROM listings GROUP BY lastcity;
-- Should show Oakland AND Berkeley
```

---

### Step 7: Test Canadian City

```bash
node unified-scraper.js city "Toronto, ON"
```

Verify country/currency:

```sql
SELECT country, currency, COUNT(*) FROM listings WHERE lastcity = 'Toronto' GROUP BY country, currency;
-- Should show: CAN, CAD
```

---

## 🚀 USAGE

### Single City
```bash
node unified-scraper.js city "Miami, FL"
node unified-scraper.js city "Vancouver, BC"
```

### Region
```bash
node unified-scraper.js region bay-area
node unified-scraper.js region texas-major-cities
```

### All Regions
```bash
node unified-scraper.js all
```

---

## 📊 MONITORING

### View Scrape Logs

```sql
SELECT * FROM scrape_logs
ORDER BY started_at DESC
LIMIT 10;
```

### Check Status Distribution

```sql
SELECT status, COUNT(*),
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM listings
GROUP BY status
ORDER BY COUNT(*) DESC;
```

### Recent New Listings

```sql
SELECT city, COUNT(*)
FROM listings
WHERE status = 'just_listed'
AND first_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY city
ORDER BY COUNT(*) DESC;
```

### Recent Price Changes

```sql
SELECT city, zpid, previous_price, unformattedprice,
       (unformattedprice - previous_price) as price_diff
FROM listings
WHERE status = 'price_changed'
AND price_change_date > NOW() - INTERVAL '24 hours'
ORDER BY ABS(unformattedprice - previous_price) DESC
LIMIT 20;
```

### Recently Sold

```sql
SELECT city, COUNT(*)
FROM listings
WHERE status = 'sold'
AND removed_at > NOW() - INTERVAL '7 days'
GROUP BY city
ORDER BY COUNT(*) DESC;
```

---

## 🔄 SCHEDULING (24 Hour Runs)

### Option 1: Cron Job

Add to crontab:

```bash
# Run all regions daily at 3 AM
0 3 * * * cd /path/to/project && node unified-scraper.js all >> logs/scraper.log 2>&1
```

### Option 2: Node Scheduler

Create `scheduler.js`:

```javascript
import cron from 'node-cron';
import { execSync } from 'child_process';

// Run all regions daily at 3 AM
cron.schedule('0 3 * * *', () => {
  console.log('Starting daily scrape...');
  execSync('node unified-scraper.js all', { stdio: 'inherit' });
});

console.log('Scheduler running...');
```

Run with:
```bash
node scheduler.js
```

### Option 3: Render/Heroku Cron

Add to `render.yaml`:

```yaml
services:
  - type: cron
    name: daily-scraper
    env: node
    schedule: "0 3 * * *"
    buildCommand: npm install
    startCommand: node unified-scraper.js all
```

---

## 🛠️ TROUBLESHOOTING

### Issue: Migration failed

**Solution:** Make sure you have permissions in Supabase. Try running through the Dashboard SQL Editor.

### Issue: "Table doesn't exist"

**Solution:** Migration didn't run. Check Step 1.

### Issue: Duplicate key errors

**Solution:** This shouldn't happen (upsert on zpid). Check if zpid is NULL in data.

### Issue: No sold listings detected

**Solution:** Normal on first scrape. Run same city twice to see status transitions.

### Issue: Too many API calls

**Solution:** Reduce `MAX_PAGES_PER_CITY` or add more delay between pages.

---

## ✅ WHAT'S SAFE

- ✅ Adding new cities - Won't affect existing data
- ✅ Re-scraping same city - Updates status correctly
- ✅ Running multiple regions - Each city tracked separately
- ✅ Mixing US and Canadian cities - Country/currency handled automatically

---

## ❌ WHAT TO AVOID

- ❌ Don't delete `listings` table - It's your source of truth
- ❌ Don't manually change zpid - It's the primary key
- ❌ Don't run same city simultaneously - Race conditions possible
- ❌ Don't skip migration - Old scrapers won't work with new schema

---

## 📈 NEXT STEPS

1. ✅ Apply migration (Step 1)
2. ✅ Test one city (Step 3)
3. ✅ Verify data (Step 4)
4. ✅ Test second scrape (Step 5)
5. ✅ Test new city (Step 6)
6. ✅ Add Canadian cities to config
7. ✅ Schedule 24hr runs
8. ✅ Monitor scrape_logs

---

## 🆘 NEED HELP?

Check the logs:
- Console output shows detailed progress
- `scrape_logs` table has run history
- Error details stored in `error_details` field

---

**Ready to migrate?** Start with Step 1! 🚀
