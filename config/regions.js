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
      },
      {
        name: "Concord",
        mapBounds: {
          north: 38.07747067508746,
          south: 37.90999098079789,
          east: -121.87211264990235,
          west: -122.10900535009766
        },
        regionId: 51518
      },
      {
        name: "San Mateo",
        mapBounds: {
          north: 37.638390027661224,
          south: 37.469911605210896,
          east: -122.20121714990233,
          west: -122.43810985009765
        },
        regionId: 13699
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
      },
      {
        name: "Santa Clarita",
        mapBounds: {
          north: 34.64447082808245,
          south: 34.29406150836516,
          east: -118.22343879980468,
          west: -118.69722420019531
        },
        regionId: 54311
      },
      {
        name: "Burbank",
        mapBounds: {
          north: 34.22595985867967,
          south: 34.13805687265353,
          east: -118.26598782495117,
          west: -118.38443417504882
        },
        regionId: 396054
      }
    ]
  },

  'san-diego-area': {
    name: 'San Diego Area',
    cities: [
      {
        name: "San Diego",
        mapBounds: {
          north: 33.18113586426592,
          south: 32.46679898311599,
          east: -116.63519309960937,
          west: -117.58276390039062
        },
        regionId: 54296
      },
      {
        name: "Poway",
        mapBounds: {
          north: 33.08588145247599,
          south: 32.90764347249133,
          east: -116.89403114990235,
          west: -117.13092385009766
        },
        regionId: 20044
      },
      {
        name: "Chula Vista",
        mapBounds: {
          north: 33.00239849708411,
          south: 32.286621879944626,
          east: -116.53426510742186,
          west: -117.48183590820311
        },
        regionId: 51405
      },
      {
        name: "Irvine",
        mapBounds: {
          north: 33.775414456669864,
          south: 33.5985836229864,
          east: -117.65580564990235,
          west: -117.89269835009766
        },
        regionId: 52650
      },
      {
        name: "Oceanside",
        mapBounds: {
          north: 33.50559190776842,
          south: 33.150460969816905,
          east: -117.18049229980468,
          west: -117.65427770019531
        },
        regionId: 6285
      },
      {
        name: "Escondido",
        mapBounds: {
          north: 33.35687608816996,
          south: 33.00113897875863,
          east: -116.80207229980468,
          west: -117.2758577001953
        },
        regionId: 11337
      },
      {
        name: "Santee",
        mapBounds: {
          north: 32.903862647027076,
          south: 32.814604963409,
          east: -116.92903982495118,
          west: -117.04748617504883
        },
        regionId: 6943
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