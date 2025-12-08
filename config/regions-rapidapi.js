// Simplified Regional Configuration for RapidAPI Scraper
// Just add city name and state - no complex coordinates needed!

export const REGIONS = {
  'bay-area': {
    name: 'Bay Area',
    cities: [
      { name: "San Francisco", state: "CA" },
      { name: "Oakland", state: "CA" },
      { name: "San Jose", state: "CA" },
      { name: "Santa Clara", state: "CA" },
      { name: "Fremont", state: "CA" },
      { name: "Daly City", state: "CA" },
      { name: "Berkeley", state: "CA" },
      { name: "Palo Alto", state: "CA" },
      { name: "Mountain View", state: "CA" },
      { name: "Sunnyvale", state: "CA" },
      { name: "Hayward", state: "CA" },
      { name: "Redwood City", state: "CA" },
    ]
  },

  'los-angeles-area': {
    name: 'Los Angeles Area',
    cities: [
      { name: "Los Angeles", state: "CA" },
      { name: "Glendale", state: "CA" },
      { name: "Pasadena", state: "CA" },
      { name: "Long Beach", state: "CA" },
      { name: "Santa Monica", state: "CA" },
      { name: "Burbank", state: "CA" },
      { name: "Torrance", state: "CA" },
      { name: "Inglewood", state: "CA" },
      { name: "Beverly Hills", state: "CA" },
      { name: "West Hollywood", state: "CA" },
    ]
  },

  'san-diego-area': {
    name: 'San Diego Area',
    cities: [
      { name: "San Diego", state: "CA" },
      { name: "Chula Vista", state: "CA" },
      { name: "Oceanside", state: "CA" },
      { name: "Carlsbad", state: "CA" },
      { name: "El Cajon", state: "CA" },
      { name: "La Mesa", state: "CA" },
      { name: "Encinitas", state: "CA" },
    ]
  },

  'sacramento-area': {
    name: 'Sacramento Area',
    cities: [
      { name: "Sacramento", state: "CA" },
      { name: "Elk Grove", state: "CA" },
      { name: "Roseville", state: "CA" },
      { name: "Folsom", state: "CA" },
      { name: "Citrus Heights", state: "CA" },
    ]
  },

  'orange-county': {
    name: 'Orange County',
    cities: [
      { name: "Irvine", state: "CA" },
      { name: "Anaheim", state: "CA" },
      { name: "Santa Ana", state: "CA" },
      { name: "Huntington Beach", state: "CA" },
      { name: "Newport Beach", state: "CA" },
      { name: "Costa Mesa", state: "CA" },
      { name: "Fullerton", state: "CA" },
    ]
  },

  'riverside-area': {
    name: 'Riverside Area',
    cities: [
      { name: "Riverside", state: "CA" },
      { name: "Corona", state: "CA" },
      { name: "Moreno Valley", state: "CA" },
      { name: "Temecula", state: "CA" },
      { name: "Murrieta", state: "CA" },
    ]
  },

  'fresno-area': {
    name: 'Fresno Area',
    cities: [
      { name: "Fresno", state: "CA" },
      { name: "Clovis", state: "CA" },
      { name: "Madera", state: "CA" },
    ]
  },

  'texas-major-cities': {
    name: 'Texas Major Cities',
    cities: [
      { name: "Houston", state: "TX" },
      { name: "Dallas", state: "TX" },
      { name: "Austin", state: "TX" },
      { name: "San Antonio", state: "TX" },
      { name: "Fort Worth", state: "TX" },
      { name: "El Paso", state: "TX" },
      { name: "Arlington", state: "TX" },
      { name: "Plano", state: "TX" },
      { name: "Irving", state: "TX" },
    ]
  },

  'florida-major-cities': {
    name: 'Florida Major Cities',
    cities: [
      { name: "Miami", state: "FL" },
      { name: "Tampa", state: "FL" },
      { name: "Orlando", state: "FL" },
      { name: "Jacksonville", state: "FL" },
      { name: "Fort Lauderdale", state: "FL" },
      { name: "St. Petersburg", state: "FL" },
      { name: "Tallahassee", state: "FL" },
      { name: "Clearwater", state: "FL" },
    ]
  },

  'new-york-area': {
    name: 'New York Area',
    cities: [
      { name: "New York", state: "NY" },
      { name: "Brooklyn", state: "NY" },
      { name: "Queens", state: "NY" },
      { name: "Bronx", state: "NY" },
      { name: "Staten Island", state: "NY" },
      { name: "Buffalo", state: "NY" },
      { name: "Rochester", state: "NY" },
      { name: "Yonkers", state: "NY" },
    ]
  },

  'washington-area': {
    name: 'Washington State',
    cities: [
      { name: "Seattle", state: "WA" },
      { name: "Spokane", state: "WA" },
      { name: "Tacoma", state: "WA" },
      { name: "Vancouver", state: "WA" },
      { name: "Bellevue", state: "WA" },
      { name: "Everett", state: "WA" },
    ]
  },

  'arizona-major-cities': {
    name: 'Arizona Major Cities',
    cities: [
      { name: "Phoenix", state: "AZ" },
      { name: "Tucson", state: "AZ" },
      { name: "Mesa", state: "AZ" },
      { name: "Chandler", state: "AZ" },
      { name: "Scottsdale", state: "AZ" },
      { name: "Tempe", state: "AZ" },
    ]
  },

  'colorado-major-cities': {
    name: 'Colorado Major Cities',
    cities: [
      { name: "Denver", state: "CO" },
      { name: "Colorado Springs", state: "CO" },
      { name: "Aurora", state: "CO" },
      { name: "Fort Collins", state: "CO" },
      { name: "Boulder", state: "CO" },
    ]
  },

  'georgia-major-cities': {
    name: 'Georgia Major Cities',
    cities: [
      { name: "Atlanta", state: "GA" },
      { name: "Augusta", state: "GA" },
      { name: "Columbus", state: "GA" },
      { name: "Savannah", state: "GA" },
      { name: "Athens", state: "GA" },
    ]
  },

  'nevada-major-cities': {
    name: 'Nevada Major Cities',
    cities: [
      { name: "Las Vegas", state: "NV" },
      { name: "Henderson", state: "NV" },
      { name: "Reno", state: "NV" },
      { name: "North Las Vegas", state: "NV" },
    ]
  },

  'north-carolina': {
    name: 'North Carolina',
    cities: [
      { name: "Charlotte", state: "NC" },
      { name: "Raleigh", state: "NC" },
      { name: "Durham", state: "NC" },
      { name: "Greensboro", state: "NC" },
      { name: "Winston-Salem", state: "NC" },
    ]
  },
};

/**
 * Get all cities across all regions
 */
export function getAllCities() {
  const allCities = [];
  for (const regionKey in REGIONS) {
    const region = REGIONS[regionKey];
    region.cities.forEach(city => {
      allCities.push({
        ...city,
        region: region.name,
        regionKey: regionKey
      });
    });
  }
  return allCities;
}

/**
 * Get cities for a specific region
 */
export function getCitiesForRegion(regionKey) {
  return REGIONS[regionKey]?.cities || [];
}

/**
 * Get all region keys
 */
export function getRegionKeys() {
  return Object.keys(REGIONS);
}

/**
 * Get total city count
 */
export function getTotalCityCount() {
  return getAllCities().length;
}

/**
 * Get total region count
 */
export function getTotalRegionCount() {
  return getRegionKeys().length;
}

// Log summary
console.log(`📊 Regions loaded: ${getTotalRegionCount()} regions, ${getTotalCityCount()} cities`);
