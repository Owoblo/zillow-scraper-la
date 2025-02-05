import { readCSV, createCSV } from "./utils.js";
import fs from "graceful-fs";
import path from "path";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://idbyrtwdeeruiutoukct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYnlydHdkZWVydWl1dG91a2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNTk0NjQsImV4cCI6MjA1MzgzNTQ2NH0.Hw0oJmIuDGdITM3TZkMWeXkHy53kO4i8TCJMxb6_hko';
const supabase = createClient(supabaseUrl, supabaseKey);

async function detectSoldListings() {
  // Backup the previous listings with a timestamp
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const backupFileName = `previous_listings_${timestamp}.csv`;
  fs.copyFileSync('previous_listings.csv', backupFileName);

  // Read the current and previous listings from CSV
  const previousListingsCSV = await readCSV('previous_listings.csv');
  const currentListingsCSV = await readCSV('listings.csv');

  const previousIdsCSV = new Set(previousListingsCSV.map(listing => listing.id));
  const currentIdsCSV = new Set(currentListingsCSV.map(listing => listing.id));

  const soldListingsCSV = previousListingsCSV.filter(listing => !currentIdsCSV.has(listing.id));

  if (soldListingsCSV.length > 0) {
    await createCSV(soldListingsCSV, "sold_listings.csv");
    console.log('Sold listings found and stored in CSV:', soldListingsCSV.map(listing => listing.address));
  } else {
    console.log('No sold listings found in CSV.');
  }

  // Overwrite previous_listings.csv with the current listings
  fs.copyFileSync('listings.csv', 'previous_listings.csv');

  // Fetch previous and current listings from Supabase
  const { data: previousListings, error: prevError } = await supabase
    .from('previous_listings')
    .select('*');

  const { data: currentListings, error: currError } = await supabase
    .from('listings1')
    .select('*');

  if (prevError || currError) {
    console.error('Error fetching data from Supabase:', prevError || currError);
    return;
  }

  const previousIds = new Set(previousListings.map(listing => listing.id));
  const currentIds = new Set(currentListings.map(listing => listing.id));

  const soldListings = previousListings.filter(listing => !currentIds.has(listing.id));

  if (soldListings.length > 0) {
    // Use upsert to handle duplicates in sold_listings
    const { error: insertError } = await supabase
      .from('sold_listings')
      .upsert(soldListings, { onConflict: ['id'] });

    if (insertError) {
      console.error('Error inserting sold listings into Supabase:', insertError);
    } else {
      console.log('Sold listings found and stored in Supabase:', soldListings.map(listing => listing.address));
    }
  } else {
    console.log('No sold listings found in Supabase.');
  }

  // Ensure complete deletion of previous listings
  const { error: deletePreviousError } = await supabase
    .from('previous_listings')
    .delete()
    .neq('id', 0); // Assuming 'id' is always greater than 0

  if (deletePreviousError) {
    console.error('Error deleting previous listings in Supabase:', deletePreviousError);
    return; // Exit if deletion fails
  }

  // Ensure unique entries before insertion
  const uniqueCurrentListings = Array.from(new Map(currentListings.map(item => [item.id, item])).values());

  const { error: updatePreviousError } = await supabase
    .from('previous_listings')
    .insert(uniqueCurrentListings);

  if (updatePreviousError) {
    console.error('Error updating previous listings in Supabase:', updatePreviousError);
    return; // Exit if insertion fails
  } else {
    console.log('Previous listings successfully updated with current listings.');
  }

  // Delete all records in listings1 to prepare for fresh data
  const { error: deleteListings1Error } = await supabase
    .from('listings1')
    .delete()
    .neq('id', 0); // Assuming 'id' is always greater than 0

  if (deleteListings1Error) {
    console.error('Error deleting current listings in Supabase:', deleteListings1Error);
  } else {
    console.log('Listings1 table cleared for fresh data.');
  }
}

(async () => {
  await detectSoldListings();
})();