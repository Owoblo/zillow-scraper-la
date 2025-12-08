# 🚀 Render Deployment Guide - Unified Scraper

## ✅ Code Pushed to GitHub

**Repository:** https://github.com/Owoblo/zillow-scraper-la

**Latest Commit:** Added unified scraper with status tracking and RapidAPI integration

---

## 🎯 THE COMMAND TO RUN EVERYTHING

```bash
node unified-scraper.js all
```

**This command:**
- ✅ Scrapes all 16 regions
- ✅ Scrapes all 105 cities
- ✅ Tracks status (just_listed, active, price_changed, sold)
- ✅ Logs everything to `scrape_logs` table
- ✅ Handles errors with retries
- ✅ Works for US + Canada

---

## 🔧 RENDER SETUP

### Option 1: Using render.yaml (Automatic) ⭐ **RECOMMENDED**

The `render.yaml` file is already configured and pushed to GitHub!

**What it does:**
- Creates a cron job called `unified-scraper-daily`
- Runs every day at **3 AM UTC** (10 PM EST / 7 PM PST)
- Executes: `node unified-scraper.js all`
- Includes your RapidAPI key

**To Deploy:**

1. Go to Render Dashboard: https://dashboard.render.com/

2. Click **"New +" → "Blueprint"**

3. Connect to your GitHub repo: `Owoblo/zillow-scraper-la`

4. Render will automatically detect `render.yaml`

5. Click **"Apply"**

6. Done! It will run automatically every 24 hours

---

### Option 2: Manual Setup (Alternative)

If you prefer manual setup:

1. Go to Render Dashboard

2. Click **"New +" → "Cron Job"**

3. Configure:
   - **Name:** `unified-scraper-daily`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node unified-scraper.js all`
   - **Schedule:** `0 3 * * *` (daily at 3 AM UTC)

4. Add Environment Variables:
   - `RAPIDAPI_KEY` = `fad289c8b7msh67ab38f37446aedp1132acjsnc18eaf48b653`
   - `NODE_ENV` = `production`

5. Click **"Create Cron Job"**

---

## 📅 SCHEDULE OPTIONS

Current schedule: **Daily at 3 AM UTC**

Want to change it? Update the cron expression:

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every 24 hours at 3 AM UTC | `0 3 * * *` | Current (10 PM EST) |
| Every 12 hours | `0 */12 * * *` | Twice daily |
| Every 6 hours | `0 */6 * * *` | 4 times daily |
| Daily at 6 AM UTC | `0 6 * * *` | 1 AM EST / 10 PM PST |
| Daily at midnight UTC | `0 0 * * *` | 7 PM EST |

---

## 🎮 MANUAL TRIGGER (Testing)

### Trigger From Render Dashboard:

1. Go to your cron job in Render
2. Click **"Manual Run"** button
3. Watch the logs in real-time

### Trigger From CLI:

```bash
# SSH into Render shell (if available)
node unified-scraper.js all
```

---

## 📊 MONITORING

### View Logs in Render:

1. Go to your cron job
2. Click **"Logs"** tab
3. See real-time output with timestamps

**Example log output:**
```
[2025-12-08T23:01:51.725Z] [Oakland] ℹ️  Starting scrape for Oakland, CA (USA)
[2025-12-08T23:01:52.752Z] [Oakland] ℹ️  Found 823 total listings across 20 pages
[2025-12-08T23:02:28.314Z] [Oakland] ✅ Oakland complete in 37s
[2025-12-08T23:02:28.314Z] [Oakland] ℹ️  Summary: 820 new, 0 updated, 0 price changes, 0 sold
```

### View Data in Supabase:

**Check scrape history:**
```sql
SELECT
  city,
  total_scraped,
  new_listings,
  updated_listings,
  price_changes,
  marked_sold,
  duration_seconds,
  started_at
FROM scrape_logs
ORDER BY started_at DESC
LIMIT 20;
```

**Check status distribution:**
```sql
SELECT status, COUNT(*)
FROM listings
GROUP BY status
ORDER BY COUNT(*) DESC;
```

---

## 🔐 ENVIRONMENT VARIABLES

Already configured in `render.yaml`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `RAPIDAPI_KEY` | `fad289...` | RapidAPI authentication |
| `NODE_ENV` | `production` | Environment flag |

**Optional variables you might add later:**
- `EMAIL_USER` - For email notifications
- `EMAIL_PASS` - Email password
- `NOTIFICATION_EMAIL` - Where to send alerts

---

## ⚙️ CUSTOMIZATION

### Run Specific Region Only:

Update `startCommand` in `render.yaml`:

```yaml
startCommand: node unified-scraper.js region bay-area
```

### Run Multiple Times Per Day:

Update `schedule`:

```yaml
schedule: "0 */12 * * *"  # Every 12 hours
```

### Change Which Cities to Scrape:

Edit `config/regions-rapidapi.js` and push to GitHub:

```javascript
'my-cities': {
  name: 'My Custom Cities',
  cities: [
    { name: "Miami", state: "FL" },
    { name: "Austin", state: "TX" },
    { name: "Toronto", state: "ON" },
  ]
},
```

Then run:
```bash
node unified-scraper.js region my-cities
```

---

## 🆘 TROUBLESHOOTING

### Job Not Running?

1. Check Render dashboard for errors
2. Verify cron schedule is correct
3. Check environment variables are set
4. Look at recent logs for failures

### API Errors?

1. Check RapidAPI quota: https://rapidapi.com/hub
2. Verify API key is correct
3. Check for rate limit errors in logs

### Database Errors?

1. Verify Supabase tables exist
2. Check credentials are correct
3. Review error in `scrape_logs.error_details`

### No Data Showing Up?

1. Check `scrape_logs` table for run history
2. Verify listings table exists
3. Look for errors in Render logs

---

## 📈 SCALING

### Current Capacity:

- **105 cities** configured
- **~820 listings/city** average
- **~86,100 total listings** potential
- **~35 seconds/city** average
- **~1 hour total** for all regions

### To Scale Up:

1. **Add more cities** to `config/regions-rapidapi.js`
2. **Add more regions** (Canada, more US states)
3. **Increase API quota** on RapidAPI if needed
4. **Run more frequently** (change cron schedule)

### To Scale Down:

1. **Remove regions** you don't need
2. **Reduce pages** per city (edit `MAX_PAGES_PER_CITY`)
3. **Run less frequently** (change to weekly, etc.)

---

## 💰 COSTS

### Render:
- **Free tier:** Includes 750 hours/month
- **Cron jobs:** Count toward free hours
- **1 hour/day** = ~30 hours/month = FREE ✅

### RapidAPI:
- Check your plan limits
- Monitor usage on RapidAPI dashboard
- Current: ~820 listings × 20 pages × 105 cities = API calls

---

## ✅ DEPLOYMENT CHECKLIST

- [x] Code pushed to GitHub
- [x] `render.yaml` configured
- [x] RapidAPI key added
- [ ] Render Blueprint deployed
- [ ] First manual test run
- [ ] Verify data in Supabase
- [ ] Monitor first automatic run
- [ ] Set up alerts (optional)

---

## 🎉 YOU'RE READY!

**Command to run everything:**
```bash
node unified-scraper.js all
```

**Render will run this automatically every 24 hours!**

**Monitor:**
- Render Dashboard: Real-time logs
- Supabase `scrape_logs`: Run history
- Supabase `listings`: Your data

**Questions?** Check the logs first, they're very detailed!

---

## 🔗 QUICK LINKS

- **Render Dashboard:** https://dashboard.render.com/
- **GitHub Repo:** https://github.com/Owoblo/zillow-scraper-la
- **Supabase Dashboard:** https://supabase.com/dashboard/project/idbyrtwdeeruiutoukct
- **RapidAPI Dashboard:** https://rapidapi.com/developer/dashboard

---

**Good luck with your deployment! 🚀**
