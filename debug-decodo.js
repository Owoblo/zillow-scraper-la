import DecodoAPI from './decodo-api.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugDecodo() {
  console.log('🔍 Debugging Decodo Response...');
  
  const decodo = new DecodoAPI();
  
  try {
    // Test both URLs
    console.log('\n🔍 Testing simple URL...');
    const simpleResult = await decodo.scrape('https://ip.decodo.com');
    console.log('Simple result HTML type:', typeof simpleResult.html);
    console.log('Simple result HTML length:', simpleResult.html?.length || 'N/A');
    
    console.log('\n🔍 Testing Zillow URL...');
    const result = await decodo.scrape('https://www.zillow.com/homes/for_sale/toronto-792680_rb/');
    
    console.log('\n📊 Full Response Structure:');
    console.log('Success:', result.success);
    console.log('Is Async:', result.isAsync);
    console.log('HTML Type:', typeof result.html);
    console.log('HTML Length:', result.html?.length || 'N/A');
    
    if (result.rawData) {
      console.log('\n📊 Raw Data Structure:');
      console.log('Keys:', Object.keys(result.rawData));
      
      if (result.rawData.results) {
        console.log('Results Type:', typeof result.rawData.results);
        console.log('Results Keys:', Object.keys(result.rawData.results));
        
        if (result.rawData.results['0']) {
          console.log('Results[0] Type:', typeof result.rawData.results['0']);
          console.log('Results[0] Keys:', Object.keys(result.rawData.results['0']));
          
          // Check if it has HTML content
          const result0 = result.rawData.results['0'];
          if (result0.html) {
            console.log('Results[0].html Length:', result0.html?.length || 'N/A');
            console.log('Results[0].html First 100 chars:', result0.html?.substring(0, 100) || 'N/A');
          } else if (result0.content) {
            console.log('Results[0].content Length:', result0.content?.length || 'N/A');
            console.log('Results[0].content First 100 chars:', result0.content?.substring(0, 100) || 'N/A');
          } else if (typeof result0 === 'string') {
            console.log('Results[0] Length:', result0.length);
            console.log('Results[0] First 100 chars:', result0.substring(0, 100));
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDecodo();
