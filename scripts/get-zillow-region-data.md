# 🔍 How to Get Accurate Region Data from Zillow

## Step-by-Step Guide

### 1. **For Toronto Area**

1. **Go to Zillow.com** and search "Toronto, ON"
2. **Open Browser Dev Tools** (F12)
3. **Go to Network Tab**
4. **Filter by "search-page-state"** or "listResults"
5. **Look for this request:**
   ```
   PUT https://www.zillow.com/async-create-search-page-state
   ```
6. **Click on the request** and go to "Request" tab
7. **Find the JSON payload** that contains:
   ```json
   {
     "searchQueryState": {
       "mapBounds": {
         "north": 43.XXXX,
         "south": 43.XXXX,
         "east": -79.XXXX,
         "west": -79.XXXX
       },
       "regionSelection": [{"regionId": XXXXXX, "regionType": 6}]
     }
   }
   ```
8. **Copy the mapBounds and regionId**

### 2. **For Vancouver Area**

1. **Search "Vancouver, BC"** on Zillow
2. **Follow same steps** as Toronto
3. **Look for mapBounds** like:
   ```json
   {
     "mapBounds": {
       "north": 49.XXXX,
       "south": 49.XXXX,
       "east": -123.XXXX,
       "west": -123.XXXX
     },
     "regionSelection": [{"regionId": XXXXXX, "regionType": 6}]
   }
   ```

### 3. **For Other GTA Cities**

Repeat the process for:
- Mississauga, ON
- Brampton, ON  
- Markham, ON
- Vaughan, ON

### 4. **Update the Configuration**

Once you have the data, update `config/regions.js`:

```javascript
'gta-area': {
  name: 'Greater Toronto Area',
  cities: [
    {
      name: "Toronto",
      mapBounds: {
        north: 43.XXXX, // Your actual data
        south: 43.XXXX, // Your actual data
        east: -79.XXXX, // Your actual data
        west: -79.XXXX, // Your actual data
      },
      regionId: XXXXXX, // Your actual data
    },
    // ... other cities with their actual data
  ]
}
```

## 🎯 What to Look For

### **In the Network Request:**
- **mapBounds**: The geographic boundaries of the search area
- **regionId**: The unique identifier for the region
- **regionType**: Should be 6 for city-level regions

### **Example of What You'll Find:**
```json
{
  "searchQueryState": {
    "pagination": {"currentPage": 1},
    "isMapVisible": true,
    "mapBounds": {
      "north": 43.7612,
      "south": 43.5812,
      "east": -79.1234,
      "west": -79.5432
    },
    "regionSelection": [
      {
        "regionId": 792680,
        "regionType": 6
      }
    ],
    "filterState": {
      "sortSelection": {"value": "globalrelevanceex"},
      "isAllHomes": {"value": true}
    }
  }
}
```

## 🚀 After Getting the Data

1. **Update `config/regions.js`** with accurate coordinates and region IDs
2. **Test the scraper**: `npm run scrape:region gta-area`
3. **Verify results** - you should see many more listings for Toronto/Vancouver

## 💡 Pro Tips

- **Use incognito mode** to avoid cached data
- **Try different search terms** (e.g., "Toronto Ontario" vs "Toronto, ON")
- **Check multiple pages** to ensure consistency
- **Save the data** in a text file before updating the config

## 🔧 Quick Test

After updating the config, test with:
```bash
npm run scrape:region gta-area
```

You should see significantly more listings for Toronto area!
