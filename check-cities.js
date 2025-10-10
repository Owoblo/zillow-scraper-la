import { getAllCities } from './config/regions.js';

const cities = getAllCities();
console.log('Total cities:', cities.length);
console.log('Cities:');
cities.forEach((city, i) => console.log(`${i+1}. ${city.name} (${city.regionName})`));
