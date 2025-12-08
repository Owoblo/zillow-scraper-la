-- Migration: Create Unified Listings Table
-- Replaces: current_listings, previous_listings, just_listed, sold_listings
-- Date: 2025-12-08

-- ============================================================
-- STEP 1: Create New Unified Table
-- ============================================================

CREATE TABLE IF NOT EXISTS listings (
  -- Primary Key
  zpid BIGINT PRIMARY KEY,

  -- Run Tracking
  lastrunid TEXT,
  lastcity TEXT,
  lastpage INTEGER,

  -- Regional Identification
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'USA',
  currency TEXT DEFAULT 'USD',

  -- Status Tracking (NEW!)
  status TEXT DEFAULT 'active',
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- Price Tracking (NEW!)
  previous_price NUMERIC,
  price_change_date TIMESTAMPTZ,

  -- Status fields
  rawhomestatuscd TEXT,
  marketingstatussimplifiedcd TEXT,
  statustype TEXT,
  statustext TEXT,

  -- Images
  imgsrc TEXT,
  hasimage BOOLEAN,

  -- URL
  detailurl TEXT,

  -- Currency
  countrycurrency TEXT,

  -- Price
  price TEXT,
  unformattedprice NUMERIC,

  -- Address
  address TEXT,
  addressstreet TEXT,
  addresszipcode TEXT,
  isundisclosedaddress BOOLEAN,
  addresscity TEXT,
  addressstate TEXT,

  -- Property Details
  beds INTEGER,
  baths INTEGER,
  area INTEGER,

  -- JSONB Fields
  latlong JSONB,
  hdpdata JSONB,
  carouselphotos JSONB,
  carousel_photos_composable JSONB,

  -- Boolean Fields
  iszillowowned BOOLEAN,
  issaved BOOLEAN,
  isuserclaimingowner BOOLEAN,
  isuserconfirmedclaim BOOLEAN,
  shouldshowzestimateasprice BOOLEAN,
  has3dmodel BOOLEAN,
  isjustlisted BOOLEAN,

  -- Additional Fields
  flexfieldtext TEXT,
  contenttype TEXT,
  pgapt TEXT,
  sgapt TEXT,
  list TEXT,
  info1string TEXT,
  brokername TEXT,
  openhousedescription TEXT,
  buildername TEXT,
  hasvideo TEXT,
  ispropertyresultcdp BOOLEAN,
  lotareastring TEXT,
  providerlistingid TEXT,
  streetviewmetadataurl TEXT,
  streetviewurl TEXT,

  -- Timestamps
  lastseenat TIMESTAMPTZ,
  openhousestartdate TEXT,
  openhouseenddate TEXT,
  availability_date TEXT
);

-- ============================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_first_seen ON listings(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(unformattedprice);
CREATE INDEX IF NOT EXISTS idx_listings_price_change ON listings(price_change_date);

-- ============================================================
-- STEP 3: Create Scrape Logs Table for Monitoring
-- ============================================================

CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  region TEXT,
  city TEXT,
  country TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT, -- 'running', 'completed', 'failed'

  -- Counts
  total_scraped INTEGER DEFAULT 0,
  new_listings INTEGER DEFAULT 0,
  updated_listings INTEGER DEFAULT 0,
  price_changes INTEGER DEFAULT 0,
  marked_sold INTEGER DEFAULT 0,

  -- Details
  pages_scraped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,

  -- Performance
  duration_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_run_id ON scrape_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_city ON scrape_logs(city);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_started_at ON scrape_logs(started_at);

-- ============================================================
-- STEP 4: Create Status Change History Table (Optional)
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_status_history (
  id SERIAL PRIMARY KEY,
  zpid BIGINT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_price NUMERIC,
  new_price NUMERIC,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  run_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_history_zpid ON listing_status_history(zpid);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON listing_status_history(changed_at);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count by status
-- SELECT status, COUNT(*) FROM listings GROUP BY status;

-- Recently listed (last 7 days)
-- SELECT COUNT(*) FROM listings WHERE status = 'just_listed' AND first_seen_at > NOW() - INTERVAL '7 days';

-- Recently sold (last 7 days)
-- SELECT COUNT(*) FROM listings WHERE status = 'sold' AND removed_at > NOW() - INTERVAL '7 days';

-- Active listings
-- SELECT COUNT(*) FROM listings WHERE status IN ('active', 'just_listed', 'price_changed');

-- Price changes (last 24 hours)
-- SELECT COUNT(*) FROM listings WHERE status = 'price_changed' AND price_change_date > NOW() - INTERVAL '24 hours';
