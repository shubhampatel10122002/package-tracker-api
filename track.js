// Example usage
const { PackageRadarTracker } = require('./PackageRadarTracker');

// Use the tracking number you provided
const trackingNumber = '1Z602AE00352228683';

async function main() {
  try {
    const tracker = new PackageRadarTracker({
      headless: true, // Set to true in production
      timeout: 60000,  // Increased timeout for loading
      saveScreenshot: true, // Save a screenshot for debugging
      saveHtml: true  // Save HTML for debugging
    });
    
    console.log('Starting tracking on PackageRadar...');
    const result = await tracker.track(trackingNumber);
    console.log('Tracking Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Focus on reporting the delivery status information
    console.log('\nDelivery Status Information:');
    console.log('-----------------------------------');
    console.log(`Status: ${result.deliveryStatus.status}`);
    console.log(`Signed By: ${result.deliveryStatus.signedBy}`);
    console.log(`Date: ${result.deliveryStatus.date}`);
    console.log(`Location: ${result.deliveryStatus.location}`);
    console.log('-----------------------------------');
    
    // Check if we got meaningful data
    if (result.deliveryStatus.status === 'Status not found') {
      console.log('\nNo delivery status found. This could be due to:');
      console.log('1. PackageRadar website structure changed');
      console.log('2. Anti-scraping measures detected the automation');
      console.log('3. The tracking number may be invalid or too new');
      console.log('\nCheck the saved screenshot and HTML file for more details.');
    }
    
    // Display event timeline if available
    if (result.events && result.events.length > 0) {
      console.log('\nTracking Events Timeline:');
      console.log('===================================');
      result.events.forEach((event, index) => {
        console.log(`[${index + 1}] ${event.status}`);
        if (event.date) console.log(`    Date: ${event.date}`);
        if (event.location) console.log(`    Location: ${event.location}`);
        console.log('---');
      });
    }
  } catch (error) {
    console.error('Tracking failed:', error.message);
  }
}

main();
