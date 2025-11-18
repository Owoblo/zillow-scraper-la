// Regional configuration for multi-city scraping
// Each region contains multiple cities with their specific Zillow coordinates

export const REGIONS = {
  'bay-area': {
    name: 'Bay Area',
    cities: [
      {
        name: "San Francisco",
        mapBounds: {
          north: 37.8324,
          south: 37.7066,
          east: -122.3488,
          west: -122.5173
        },
        regionId: 20330
      },
      {
        name: "Santa Clara",
        mapBounds: {
          north: 37.455297830255525,
          south: 37.2864058779661,
          east: -121.84966614990233,
          west: -122.08655885009765
        },
        regionId: 13713
      },
      {
        name: "Fremont",
        mapBounds: {
          north: 37.69776799412656,
          south: 37.36069931301041,
          east: -121.77157829980469,
          west: -122.24536370019531
        },
        regionId: 11540
      },
      {
        name: "Daly City",
        mapBounds: {
          north: 37.72051140645762,
          south: 37.63641286199249,
          east: -122.39369532495115,
          west: -122.51214167504881
        },
        regionId: 31163
      }
    ]
  },

  'los-angeles-area': {
    name: 'Los Angeles Area',
    cities: [
      {
        name: "Los Angeles",
        mapBounds: {
          north: 34.37261942110358,
          south: 33.66805909675749,
          east: -117.93794709960937,
          west: -118.88551790039062
        },
        regionId: 12447
      },
      {
        name: "Glendale",
        mapBounds: {
          north: 34.280874872460096,
          south: 34.10509187356211,
          east: -118.12648064990236,
          west: -118.36337335009767
        },
        regionId: 45457
      },
      {
        name: "Pasadena",
        mapBounds: {
          north: 34.27036955218186,
          south: 34.09456463550566,
          east: -118.01324264990234,
          west: -118.25013535009765
        },
        regionId: 47019
      }
    ]
  }

};

// Helper functions for working with regions
export function getAllCities() {
  const allCities = [];
  Object.entries(REGIONS).forEach(([regionKey, region]) => {
    region.cities.forEach(city => {
      allCities.push({
        ...city,
        regionName: region.name,
        regionKey: regionKey
      });
    });
  });
  return allCities;
}

export function getCitiesForRegion(regionKey) {
  return REGIONS[regionKey]?.cities || [];
}

export function getRegionKeys() {
  return Object.keys(REGIONS);
}

export function getRegionByName(regionName) {
  return Object.values(REGIONS).find(region => region.name === regionName);
}