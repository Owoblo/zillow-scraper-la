# Real-Time Zillow Listing Detection System

A comprehensive system for scraping Zillow listings and detecting just-listed and sold properties in real-time.

## 🚀 Features

- **Real-time Detection**: Automatically detects just-listed and sold listings
- **Automatic Table Management**: Seamlessly switches between current and previous listings
- **Efficient Database Operations**: Uses Supabase for fast, reliable data storage
- **Scheduled Execution**: Run at custom intervals (default: 30 minutes)
- **Comprehensive Logging**: Track all operations with detailed logs

## 📊 Database Tables

The system uses 5 main tables:

1. **`current_listings`** - Stores the most recent scraped listings
2. **`previous_listings`** - Stores the previous run's listings for comparison
3. **`just_listed`** - Contains newly listed properties (in current but not in previous)
4. **`sold_listings`** - Contains sold properties (in previous but not in current)
5. **`runs`** - Tracks scraping run metadata

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```bash
export SMARTPROXY_USER="your_proxy_username"
export SMARTPROXY_PASS="your_proxy_password"
```

### 3. Setup Database Tables
```bash
node setupDatabase.js
```

## 🚀 Usage

### Single Run
Run the scraper and detection once:
```bash
node zillow.js
```

### Real-time Mode
Run continuously with automatic scheduling:
```bash
node runRealtime.js
```

### Detection Only
Run just the detection logic (if you have existing data):
```bash
node detectSoldListings.js
```

## 📁 Output Files

- `listings.csv` - Raw scraped data
- `just_listed.json` - Just-listed properties
- `sold_listings.json` - Sold properties
- `realtime_log.txt` - System logs (in real-time mode)

## 🔄 How It Works

1. **Scrape**: Fetches current listings from Zillow
2. **Store**: Saves to `current_listings` table
3. **Compare**: Compares with `previous_listings` table
4. **Detect**: Identifies just-listed and sold properties
5. **Store Results**: Saves to `just_listed` and `sold_listings` tables
6. **Switch**: Moves current to previous, clears current for next run

## ⚙️ Configuration

### Scraping Areas
Edit the `mapBoundsList` in `zillow.js` to add/remove areas:

```javascript
const mapBoundsList = [
  {
    name: "Windsor",
    mapBounds: { north: 42.379, south: 42.224, east: -82.937, west: -83.174 },
    regionId: 792741
  },
  // Add more areas...
];
```

### Timing
Adjust intervals in `runRealtime.js`:

```javascript
const INTERVAL_MINUTES = 30; // Change to desired interval
```

### Batch Sizes
Modify batch sizes in `zillow.js`:

```javascript
const UPSERT_BATCH_SIZE = 250; // Increase for faster processing
const PAGE_DELAY_MS = 800;     // Decrease for faster scraping
```

## 📈 Monitoring

### Check Just-Listed Properties
```sql
SELECT * FROM just_listed ORDER BY lastSeenAt DESC LIMIT 10;
```

### Check Sold Properties
```sql
SELECT * FROM sold_listings ORDER BY lastSeenAt DESC LIMIT 10;
```

### View Run History
```sql
SELECT * FROM runs ORDER BY started_at DESC;
```

## 🐛 Troubleshooting

### Common Issues

1. **Proxy Errors**: Ensure SMARTPROXY credentials are set correctly
2. **Database Errors**: Check Supabase connection and table permissions
3. **Rate Limiting**: Increase `PAGE_DELAY_MS` if getting blocked
4. **Memory Issues**: Reduce `UPSERT_BATCH_SIZE` for large datasets

### Logs
Check `realtime_log.txt` for detailed error messages and system status.

## 🔧 Advanced Usage

### Custom Detection Logic
Modify `detectJustListedAndSold()` in `zillow.js` to add custom filtering:

```javascript
// Example: Only detect listings under $500k
const justListed = currentListings.filter(listing => 
  !previousZpidSet.has(listing.zpid) && 
  listing.unformattedPrice < 500000
);
```

### Integration with Frontend
Use the helper functions to fetch data:

```javascript
import { getJustListed, getSoldListings } from './detectSoldListings.js';

const justListed = await getJustListed();
const soldListings = await getSoldListings();
```

## 📝 Notes

- The system automatically handles table switching after each run
- All operations are logged for debugging and monitoring
- The system is designed to be fault-tolerant with retry mechanisms
- Data is stored efficiently using JSONB for complex fields

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
