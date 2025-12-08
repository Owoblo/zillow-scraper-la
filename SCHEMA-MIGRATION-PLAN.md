# Database Schema Migration Plan
## From Multi-Table to Single-Table Design

---

## 🎯 GOAL
Simplify from 4 tables to 1 unified table with status tracking

---

## 📊 CURRENT SCHEMA (Complex)

```
Tables:
├── current_listings   (today's scrape)
├── previous_listings  (yesterday's scrape)
├── just_listed        (newly discovered)
└── sold_listings      (disappeared)

Problems:
❌ Data duplication
❌ Complex diff logic
❌ Hard to track history
❌ Inefficient at scale
❌ Hard to query "all active" or "all sold"
```

---

## ✅ NEW SCHEMA (Simple & Scalable)

```
Single Table: listings

Core Listing Data:
├── zpid (PRIMARY KEY)
├── price
├── bedrooms, bathrooms, livingArea
├── address, city, state, zipcode
├── latitude, longitude
├── country (USA/CAN)
├── currency (USD/CAD)
├── ... (all existing fields)

Status Tracking (NEW):
├── status (enum)
│   ├── 'just_listed'   - First time seen
│   ├── 'active'        - Still available
│   ├── 'price_changed' - Price updated
│   ├── 'sold'          - No longer available
│   └── 'off_market'    - Temporarily removed
│
├── first_seen_at (timestamp)
│   └── When listing was first discovered
│
├── last_seen_at (timestamp)
│   └── Last scrape where it appeared
│
├── last_updated_at (timestamp)
│   └── When any data changed
│
├── removed_at (timestamp)
│   └── When it disappeared from listings
│
├── previous_price (numeric)
│   └── Price before last change
│
├── price_change_date (timestamp)
│   └── When price last changed
│
└── days_on_market (computed)
    └── Days between first_seen_at and removed_at/now
```

---

## 🔄 THE SCRAPING LOGIC

### **On Each Scrape Run:**

```javascript
for each scraped listing:

  1. Check if zpid exists in database

  2. IF NOT EXISTS:
     INSERT new row
     - status = 'just_listed'
     - first_seen_at = NOW()
     - last_seen_at = NOW()
     - All listing data

  3. IF EXISTS:
     Compare current data with database

     3a. IF price changed:
         UPDATE
         - previous_price = old price
         - price = new price
         - status = 'price_changed'
         - price_change_date = NOW()
         - last_seen_at = NOW()

     3b. IF other data changed:
         UPDATE
         - Changed fields
         - last_updated_at = NOW()
         - last_seen_at = NOW()

     3c. IF nothing changed:
         UPDATE
         - last_seen_at = NOW()
         - status = 'active'

4. AFTER scrape completes:
   Find listings NOT seen in this scrape
   (last_seen_at < scrape_start_time)

   UPDATE those listings
   - status = 'sold' OR 'off_market'
   - removed_at = NOW()
```

---

## 📈 BENEFITS

✅ **Single Source of Truth**
   - One table, all data
   - No duplication

✅ **Easy Queries**
   ```sql
   -- All active listings
   SELECT * FROM listings WHERE status IN ('active', 'just_listed', 'price_changed')

   -- Just listed in last 7 days
   SELECT * FROM listings WHERE status = 'just_listed' AND first_seen_at > NOW() - INTERVAL '7 days'

   -- Recently sold
   SELECT * FROM listings WHERE status = 'sold' AND removed_at > NOW() - INTERVAL '7 days'

   -- Price changes
   SELECT * FROM listings WHERE status = 'price_changed' ORDER BY price_change_date DESC
   ```

✅ **Automatic History**
   - Track entire lifecycle
   - Know exactly when things changed

✅ **Scalable**
   - Works for 100 cities or 10,000 cities
   - Indexes handle performance

✅ **Simple Logic**
   - No complex diffs
   - Just upsert with status tracking

---

## 🚀 MIGRATION STEPS

### **Step 1: Create New Table**
```sql
CREATE TABLE listings_new (
  -- All existing columns from current_listings
  zpid BIGINT PRIMARY KEY,
  price TEXT,
  unformattedprice NUMERIC,
  bedrooms INT,
  bathrooms INT,
  -- ... all other existing fields ...

  -- NEW status tracking columns
  status TEXT DEFAULT 'active',
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  previous_price NUMERIC,
  price_change_date TIMESTAMP,

  -- Indexes for performance
  CREATE INDEX idx_status ON listings_new(status);
  CREATE INDEX idx_first_seen ON listings_new(first_seen_at);
  CREATE INDEX idx_last_seen ON listings_new(last_seen_at);
  CREATE INDEX idx_country ON listings_new(country);
  CREATE INDEX idx_city ON listings_new(city);
);
```

### **Step 2: Migrate Existing Data**
```sql
-- Copy current_listings to new table
INSERT INTO listings_new
SELECT
  *,
  'active' as status,
  lastseenat as first_seen_at,
  lastseenat as last_seen_at,
  lastseenat as last_updated_at,
  NULL as removed_at,
  NULL as previous_price,
  NULL as price_change_date
FROM current_listings;

-- Mark sold listings as sold
UPDATE listings_new
SET status = 'sold', removed_at = NOW()
WHERE zpid IN (SELECT zpid FROM sold_listings);
```

### **Step 3: Update Scraper Logic**
- Modify scraper to use new single-table logic
- Add status tracking on upsert
- Add "mark as sold" after scrape

### **Step 4: Test with Small City**
- Run scraper on one small city
- Verify data integrity
- Check status transitions

### **Step 5: Rename Tables**
```sql
-- Backup old tables
ALTER TABLE current_listings RENAME TO current_listings_backup;
ALTER TABLE previous_listings RENAME TO previous_listings_backup;
ALTER TABLE just_listed RENAME TO just_listed_backup;
ALTER TABLE sold_listings RENAME TO sold_listings_backup;

-- Activate new table
ALTER TABLE listings_new RENAME TO listings;
```

### **Step 6: Update Frontend/Queries**
- Update any queries that reference old tables
- Point to new `listings` table with status filters

### **Step 7: Monitor & Cleanup**
- Run for 1 week
- Verify everything works
- Drop backup tables

---

## 🎯 EMAIL NOTIFICATIONS

**Before:** Query `just_listed` table

**After:** Query `listings WHERE status = 'just_listed'`

**Even Better:**
```sql
-- Just listed today
SELECT * FROM listings
WHERE status = 'just_listed'
AND first_seen_at > NOW() - INTERVAL '24 hours';

-- Price drops
SELECT * FROM listings
WHERE status = 'price_changed'
AND price < previous_price
AND price_change_date > NOW() - INTERVAL '24 hours';
```

---

## 🔐 SAFETY MEASURES

1. **Backup everything first**
   ```bash
   pg_dump your_database > backup_before_migration.sql
   ```

2. **Keep old tables during migration**
   - Rename, don't drop
   - Keep for 1-2 weeks

3. **Test on small dataset first**
   - Run on 1 city
   - Verify results

4. **Parallel run initially**
   - Write to both old and new tables
   - Compare results
   - Switch when confident

---

## 📋 CHECKLIST

- [ ] Review plan
- [ ] Backup current database
- [ ] Create new table schema
- [ ] Migrate existing data
- [ ] Update scraper logic
- [ ] Test with 1 city
- [ ] Compare old vs new results
- [ ] Full migration
- [ ] Update email notifications
- [ ] Update frontend queries
- [ ] Monitor for 1 week
- [ ] Drop old tables

---

## 🤔 QUESTIONS TO ANSWER

1. **Do we migrate all historical data or start fresh?**
   - Migrate: Keeps history but complex
   - Fresh: Clean start, simpler

2. **How long to keep sold listings?**
   - Forever? (full history)
   - 90 days? (recent only)
   - Archive old ones?

3. **Status enum values - are these right?**
   - just_listed
   - active
   - price_changed
   - sold
   - off_market

   Any others needed?

4. **Initial scrape for existing cities?**
   - Mark all as 'active'?
   - Or 'just_listed'?

---

## 💬 NEXT STEPS

Once you approve this plan:
1. I'll create the new table schema
2. I'll update the scraper with new logic
3. We'll test on one city
4. Then migrate everything

**Sound good?** Let me know if you want to adjust anything!
