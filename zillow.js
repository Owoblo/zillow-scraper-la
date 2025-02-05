import fetch from "node-fetch";
import fs from "graceful-fs";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createCSV } from "./utils.js";
import { getSmartProxyAgent } from './proxies.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertAllListingsToSupabase(listings) {
  const batchSize = 500; // Adjust batch size as needed

  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);

    // Remove duplicates within the batch
    const uniqueBatch = Array.from(new Map(batch.map(item => [item.id, item])).values());

    const { data, error } = await supabase
      .from('listings1')
      .upsert(uniqueBatch, { onConflict: ['id'] });

    if (error) {
      console.error('Error upserting data into Supabase:', error);
    } else {
      console.log('Batch successfully upserted into Supabase:', data);
    }
  }
}

async function getSearchResults() {
  const mapBoundsList = [
    {
      name: "Windsor",
      mapBounds: {
        north: 42.379853672968274,
        south: 42.224961088031165,
        east: -82.93768364990234,
        west: -83.17457635009765,
      },
      regionId: 792741, // Replace with the actual regionId for Windsor
    },
    {
        name: "Kingsville",
        mapBounds: {
          north: 42.167651579593674,
          south: 41.81858574635527,
          east: -82.26331609960936,
          west: -83.2108869003906,
        },
        regionId: 792756, // Replace with the actual regionId for Windsor
      },
      {
        name: "Leamington",
        mapBounds: {
          north: 42.273286314605585,
          south: 41.574403819336325,
          east: -81.61673969921874,
          west: -83.51188130078124,
        },
        regionId: 792755, // Replace with the actual regionId for Windsor
      },
      {
        name: "Lakeshore",
        mapBounds: {
          north: 42.45536205960347,
          south: 42.107882876787656,
          east: -82.17987909960938,
          west: -83.12744990039063,
        },
        regionId: 792743, // Replace with the actual regionId for Windsor
      },
      {
        name: "Essex",
        mapBounds: {
          north: 42.35693355455835,
          south: 41.65897311399216,
          east: -81.95478919921874,
          west: -83.84993080078124,
        },
        regionId: 792746, // Replace with the actual regionId for Windsor
      },
      {
        name: "Tecumseh",
        mapBounds: {
          north: 42.4472968476294,
          south: 42.09977306666839,
          east: -82.44688209960938,
          west: -83.39445290039063,
        },
        regionId: 792744, // Replace with the actual regionId for Windsor
      },
      {
        name: "Lasalle",
        mapBounds: {
          north: 42.258285521989045,
          south: 42.17132333079737,
          east: -82.94703214990234,
          west: -83.18392485009765,
        },
        regionId: 792742, // Replace with the actual regionId for Windsor
      },
    {
      name: "Chatham-Kent",
      mapBounds: {
        north: 42.70246107047282,
        south: 42.008325430421465,
        east: -81.10681869921875,
        west: -83.00196030078125,
      },
      regionId: 792753, // Replace with the actual regionId for Chatham-Kent
    },
    {
      name: "Amherstburg",
      mapBounds: {
        north: 42.190559,
        south: 41.830582,
        east: -82.96736,
        west: -83.14951,
      },
      regionId: 792745, // Replace with the actual regionId for Amherstburg
    },
    {
      name: "Ottawa",
      mapBounds: {
        north: 45.7,
        south: 44.8,
        east: -74.7,
        west: -76.9,
      },
      regionId: 792772,
    },
    {
      name: "Clarence-Rockland",
      mapBounds: {
        north: 45.7,
        south: 45.2,
        east: -74.6,
        west: -75.8,
      },
      regionId: 792767,
    },
    {
      name: "Casselman",
      mapBounds: {
        north: 45.4,
        south: 45.2,
        east: -74.8,
        west: -75.3,
      },
      regionId: 792768,
    },
    {
      name: "Stittsville",
      mapBounds: {
        north: 45.3,
        south: 45.2,
        east: -75.9,
        west: -76.0,
      },
      regionId: 792769,
    },
    {
      name: "Kanata",
      mapBounds: {
        north: 45.4,
        south: 45.3,
        east: -75.8,
        west: -76.0,
      },
      regionId: 792770,
    },
    {
      name: "Russell",
      mapBounds: {
        north: 45.3,
        south: 45.2,
        east: -75.3,
        west: -75.5,
      },
      regionId: 792771,
    },
    {
      name: "Carleton Place",
      mapBounds: {
        north: 45.2,
        south: 45.1,
        east: -76.1,
        west: -76.3,
      },
      regionId: 792772,
    },
    // Add more cities with their specific map bounds and regionId
  ];

  const allListings = [];

  for (const area of mapBoundsList) {
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const searchQueryState = {
        pagination: {
          currentPage: currentPage,
        },
        isMapVisible: true,
        mapBounds: area.mapBounds,
        regionSelection: [{ regionId: area.regionId, regionType: 6 }],
        filterState: {
          sortSelection: { value: "globalrelevanceex" },
          isAllHomes: { value: true },
        },
        isEntirePlaceForRent: true,
        isRoomForRent: false,
        isListVisible: true,
      };

      const res = await fetch(
        "https://www.zillow.com/async-create-search-page-state",
        {
          agent: getSmartProxyAgent(),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            priority: "u=1, i",
            "sec-ch-ua":
              '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://www.zillow.com/homes/Windsor,-ON_rb/",
            "Referrer-Policy": "unsafe-url",
          },
          body: JSON.stringify({
            searchQueryState,
            wants: {
              cat1: ["listResults", "mapResults"],
              cat2: ["total"],
            },
          }),
          method: "PUT",
        }
      );

      const text = await res.text();

      try {
        const json = JSON.parse(text);
        const listings = json["cat1"].searchResults.listResults;
        allListings.push(...listings);
        hasMorePages = listings.length > 0;
      } catch (error) {
        console.error('Error parsing JSON:', error);
        hasMorePages = false;
      }

      currentPage++;
    }
  }

  fs.writeFileSync("test.json", JSON.stringify(allListings, null, 2));
  console.log('All listings:', allListings.map((x) => x.address));

  // Upsert all listings into Supabase
  await upsertAllListingsToSupabase(allListings);

  return allListings;
}

async function getListingDetails(zpid) {
  const res = await fetch(
    `https://www.zillow.com/graphql/?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%2222f1569a25f23a90bb2445ce2fb8f7a3fcf2daedd91fa86e43e7a120a17f6b93%22%7D%7D&variables=%7B%22zpid%22%3A%22${zpid}%22%2C%22zillowPlatform%22%3A%22DESKTOP%22%2C%22altId%22%3Anull%7D`,
    {
      agent: getSmartProxyAgent(),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "client-id": "showcase-subapp-client",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        Referer:
          "https://www.zillow.com/homedetails/3221-Everts-Ave-Windsor-ON-N9E-2V7/441821556_zpid/",
        "Referrer-Policy": "unsafe-url",
      },
      body: null,
      method: "GET",
    }
  );
  const json = await res.json();
  fs.writeFileSync("test.json", JSON.stringify(json, null, 2));
  console.log(json);
}

(async () => {
  const listings = await getSearchResults();
  await createCSV(listings, "listings.csv");
  await getListingDetails(35192848);
  await getListingDetails(35205694);
})();

console.log('Proxy User:', process.env.SMARTPROXY_USER);
console.log('Proxy Pass:', process.env.SMARTPROXY_PASS ? '****' : 'Not Set');
