// Advanced city scheduling with anti-detection patterns
import { getAllCities } from './config/regions.js';

// City scheduling strategies
const SCHEDULING_STRATEGIES = {
  RANDOM: 'random',
  ROUND_ROBIN: 'round_robin',
  WEIGHTED: 'weighted',
  REGION_ALTERNATING: 'region_alternating'
};

// City difficulty weights (based on historical success rates)
const CITY_DIFFICULTY = {
  // Easy cities (high success rate)
  'Windsor': 1.0,
  'Kingsville': 1.0,
  'Leamington': 1.0,
  'Lakeshore': 1.0,
  'Essex': 1.0,
  'Tecumseh': 1.0,
  'Lasalle': 0.8, // Slightly harder
  'Chatham-Kent': 1.0,
  'Amherstburg': 1.0,
  
  // Medium cities
  'Richmond Hill': 0.9,
  'Vaughan': 0.9,
  'Markham': 0.8,
  'Brampton': 0.8,
  'Mississauga': 0.7,
  'Toronto': 0.6,
  
  // Hard cities (US cities, large markets)
  'Milwaukee': 0.5,
  'Oakville': 0.6,
  'Burlington': 0.6
};

// Time-based scheduling patterns
const TIME_PATTERNS = {
  MORNING: { start: 6, end: 12, weight: 0.8 },
  AFTERNOON: { start: 12, end: 18, weight: 1.0 },
  EVENING: { start: 18, end: 22, weight: 0.9 },
  NIGHT: { start: 22, end: 6, weight: 0.7 }
};

class AdvancedScheduler {
  constructor() {
    this.allCities = getAllCities();
    this.schedulingHistory = [];
    this.currentStrategy = SCHEDULING_STRATEGIES.WEIGHTED;
    this.regionOrder = ['Windsor Area', 'Greater Toronto Area', 'Milwaukee Area', 'GTA Extended'];
    this.currentRegionIndex = 0;
  }

  // Get current time pattern weight
  getCurrentTimeWeight() {
    const hour = new Date().getHours();
    
    for (const [pattern, config] of Object.entries(TIME_PATTERNS)) {
      if (config.start <= config.end) {
        if (hour >= config.start && hour < config.end) {
          return config.weight;
        }
      } else {
        // Handle overnight patterns (22:00 - 06:00)
        if (hour >= config.start || hour < config.end) {
          return config.weight;
        }
      }
    }
    
    return 1.0; // Default weight
  }

  // Get cities by region with difficulty weighting
  getCitiesByRegion(regionName) {
    return this.allCities
      .filter(city => city.regionName === regionName)
      .map(city => ({
        ...city,
        difficulty: CITY_DIFFICULTY[city.name] || 0.5,
        lastScraped: this.getLastScrapedTime(city.name)
      }));
  }

  // Get last scraped time for a city
  getLastScrapedTime(cityName) {
    const history = this.schedulingHistory.filter(h => h.city === cityName);
    return history.length > 0 ? history[history.length - 1].timestamp : 0;
  }

  // Calculate city priority score
  calculatePriorityScore(city) {
    const timeSinceLastScrape = Date.now() - city.lastScraped;
    const timeWeight = Math.min(timeSinceLastScrape / (30 * 60 * 1000), 2.0); // Max 2x after 30 min
    const difficultyWeight = city.difficulty;
    const timePatternWeight = this.getCurrentTimeWeight();
    
    return difficultyWeight * timeWeight * timePatternWeight;
  }

  // Randomize city order within region
  randomizeCityOrder(cities) {
    const shuffled = [...cities];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  // Weighted random selection
  weightedRandomSelection(cities) {
    const scores = cities.map(city => this.calculatePriorityScore(city));
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    
    if (totalScore === 0) return cities[0];
    
    let random = Math.random() * totalScore;
    
    for (let i = 0; i < cities.length; i++) {
      random -= scores[i];
      if (random <= 0) {
        return cities[i];
      }
    }
    
    return cities[cities.length - 1];
  }

  // Get next city to scrape
  getNextCity() {
    const availableRegions = this.regionOrder.filter(region => {
      const cities = this.getCitiesByRegion(region);
      return cities.length > 0;
    });

    if (availableRegions.length === 0) {
      return null;
    }

    // Rotate regions
    const currentRegion = availableRegions[this.currentRegionIndex % availableRegions.length];
    this.currentRegionIndex++;

    const cities = this.getCitiesByRegion(currentRegion);
    
    if (cities.length === 0) {
      return this.getNextCity(); // Try next region
    }

    let selectedCity;
    
    switch (this.currentStrategy) {
      case SCHEDULING_STRATEGIES.RANDOM:
        selectedCity = cities[Math.floor(Math.random() * cities.length)];
        break;
        
      case SCHEDULING_STRATEGIES.WEIGHTED:
        selectedCity = this.weightedRandomSelection(cities);
        break;
        
      case SCHEDULING_STRATEGIES.REGION_ALTERNATING:
        // Process all cities in region in random order
        const randomizedCities = this.randomizeCityOrder(cities);
        selectedCity = randomizedCities[0];
        break;
        
      default:
        selectedCity = cities[0];
    }

    // Record scheduling
    this.schedulingHistory.push({
      city: selectedCity.name,
      region: selectedCity.regionName,
      timestamp: Date.now(),
      strategy: this.currentStrategy
    });

    // Keep only last 1000 records
    if (this.schedulingHistory.length > 1000) {
      this.schedulingHistory = this.schedulingHistory.slice(-1000);
    }

    return selectedCity;
  }

  // Get all cities in optimal order for batch processing
  getAllCitiesInOrder() {
    const allCities = [];
    const availableRegions = this.regionOrder.filter(region => {
      const cities = this.getCitiesByRegion(region);
      return cities.length > 0;
    });

    for (const region of availableRegions) {
      const cities = this.getCitiesByRegion(region);
      
      // Sort by priority score (highest first)
      const sortedCities = cities.sort((a, b) => 
        this.calculatePriorityScore(b) - this.calculatePriorityScore(a)
      );
      
      // Randomize within similar priority groups
      const randomizedCities = this.randomizeCityOrder(sortedCities);
      allCities.push(...randomizedCities);
    }

    return allCities;
  }

  // Change scheduling strategy
  setStrategy(strategy) {
    if (Object.values(SCHEDULING_STRATEGIES).includes(strategy)) {
      this.currentStrategy = strategy;
      console.log(`🔄 Changed scheduling strategy to: ${strategy}`);
    }
  }

  // Get scheduling statistics
  getStats() {
    const now = Date.now();
    const recentHistory = this.schedulingHistory.filter(h => now - h.timestamp < 3600000); // Last hour
    
    const regionCounts = {};
    const cityCounts = {};
    
    recentHistory.forEach(entry => {
      regionCounts[entry.region] = (regionCounts[entry.region] || 0) + 1;
      cityCounts[entry.city] = (cityCounts[entry.city] || 0) + 1;
    });

    return {
      totalScheduled: recentHistory.length,
      regionDistribution: regionCounts,
      cityDistribution: cityCounts,
      currentStrategy: this.currentStrategy
    };
  }
}

// Export singleton instance
export const scheduler = new AdvancedScheduler();

// Export utilities
export { SCHEDULING_STRATEGIES, CITY_DIFFICULTY, TIME_PATTERNS };
