// Regional configuration for multi-city scraping
// Each region contains multiple cities with their specific Zillow coordinates

export const REGIONS = {
  'windsor-area': {
    name: 'Windsor Area',
    cities: [
      {
        name: "Windsor",
        mapBounds: {
          north: 42.379853672968274,
          south: 42.224961088031165,
          east: -82.93768364990234,
          west: -83.17457635009765,
        },
        regionId: 792741,
      },
      {
        name: "Kingsville",
        mapBounds: {
          north: 42.167651579593674,
          south: 41.81858574635527,
          east: -82.26331609960936,
          west: -83.2108869003906,
        },
        regionId: 792756,
      },
      {
        name: "Leamington",
        mapBounds: {
          north: 42.273286314605585,
          south: 41.574403819336325,
          east: -81.61673969921874,
          west: -83.51188130078124,
        },
        regionId: 792755,
      },
      {
        name: "Lakeshore",
        mapBounds: {
          north: 42.45536205960347,
          south: 42.107882876787656,
          east: -82.17987909960938,
          west: -83.12744990039063,
        },
        regionId: 792743,
      },
      {
        name: "Essex",
        mapBounds: {
          north: 42.35693355455835,
          south: 41.65897311399216,
          east: -81.95478919921874,
          west: -83.84993080078124,
        },
        regionId: 792746,
      },
      {
        name: "Tecumseh",
        mapBounds: {
          north: 42.4472968476294,
          south: 42.09977306666839,
          east: -82.44688209960938,
          west: -83.39445290039063,
        },
        regionId: 792744,
      },
      {
        name: "Lasalle",
        mapBounds: {
          north: 42.258285521989045,
          south: 42.17132333079737,
          east: -82.94703214990234,
          west: -83.18392485009765,
        },
        regionId: 792742,
      },
      {
        name: "Chatham-Kent",
        mapBounds: {
          north: 42.70246107047282,
          south: 42.008325430421465,
          east: -81.10681869921875,
          west: -83.00196030078125,
        },
        regionId: 792753,
      },
      {
        name: "Amherstburg",
        mapBounds: {
          north: 42.190559,
          south: 41.830582,
          east: -82.96736,
          west: -83.14951,
        },
        regionId: 792745,
      },
    ]
  },

    'gta-area': {
    name: 'Greater Toronto Area',
    cities: [
      {
        name: "Toronto",
        mapBounds: {
          north: 43.855465,
          south: 43.560343,
          east: -79.113467,
          west: -79.639302
        },
        regionId: 792680
      },
      {
        name: "Mississauga",
        mapBounds: {
          north: 43.737325,
          south: 43.474915,
          east: -79.52296,
          west: -79.810253
        },
        regionId: 792679
      },
      {
        name: "Brampton",
        mapBounds: {
          north: 43.847718,
          south: 43.602231,
          east: -79.63027,
          west: -79.888871
        },
        regionId: 792682
      },
      {
        name: "Markham",
        mapBounds: {
          north: 43.963481,
          south: 43.797993,
          east: -79.170246,
          west: -79.428712
        },
        regionId: 792840
      },
      {
        name: "Vaughan",
        mapBounds: {
          north: 43.924272,
          south: 43.749846,
          east: -79.420074,
          west: -79.711513
        },
        regionId: 792841
      },
      {
        name: "Richmond Hill",
        mapBounds: {
          north: 43.977803,
          south: 43.829371,
          east: -79.370665,
          west: -79.485549
        },
        regionId: 792839
      },
    ]
  },

  'milwaukee-area': {
    name: 'Milwaukee Area',
    cities: [
      {
        name: "Milwaukee",
        mapBounds: {
          north: 43.13175115230508,
          south: 42.9842495746899,
          east: -87.73042429980468,
          west: -88.2042097001953,
        },
        regionId: 5976,
      },
    ]
  },

  'gta-extended': {
    name: 'GTA Extended',
    cities: [
      {
        name: "Oakville",
        mapBounds: {
          north: 43.526527,
          south: 43.368931,
          east: -79.616164,
          west: -79.810953
        },
        regionId: 792724
      },
      {
        name: "Burlington",
        mapBounds: {
          north: 43.476542,
          south: 43.286158,
          east: -79.720181,
          west: -79.959305
        },
        regionId: 792723
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