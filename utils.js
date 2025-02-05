import { createObjectCsvWriter } from "csv-writer";
import csv from "csv-parser";
import fs from "graceful-fs";

export async function createCSV(arrayOfData, fileName) {
  try {
    if (!arrayOfData.length) {
      console.log("no data to write for", fileName);
      return;
    }
    const headers = Object.keys(arrayOfData[0]).map((header) => ({
      id: header,
      title: header,
    }));
    console.log("createcsv called");
    const csvWriter = createObjectCsvWriter({
      path: fileName,
      header: headers,
    });
    await csvWriter.writeRecords(arrayOfData);
    console.log("The CSV file was written successfully", fileName);
  } catch (error) {
    console.log("error at createCSV", error);
  }
}

export function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// export async function detectSoldListings(newListings) {
//   const previousListings = await readCSV('listings.csv');
//   console.log('Previous Listings:', previousListings);
//   console.log('New Listings:', newListings);

//   const previousIds = new Set(previousListings.map(listing => listing.id));
//   const currentIds = new Set(newListings.map(listing => listing.id));

//   const soldListings = previousListings.filter(listing => !currentIds.has(listing.id));
//   console.log('Sold listings:', soldListings.map(listing => listing.address));

//   if (soldListings.length > 0) {
//     fs.writeFileSync('sold_listings.json', JSON.stringify(soldListings, null, 2));
//   }
// }
