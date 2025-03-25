// Create a new file called multi-source-tracker.js
// This provides a way to track packages from multiple sources if the primary one fails

const { PackageRadarTracker } = require('./PackageRadarTracker');
const { FallbackTracker } = require('./fallback-tracker');
const axios = require('axios');

class MultiSourceTracker {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 2,
      saveScreenshot: options.saveScreenshot || false,
      cookies: options.cookies || []
    };
    
    // Initialize trackers
    this.packageRadarTracker = new PackageRadarTracker({
      headless: true,
      timeout: this.options.timeout,
      saveScreenshot: this.options.saveScreenshot,
      maxRetries: this.options.maxRetries,
      cookies: this.options.cookies
    });
    
    this.fallbackTracker = new FallbackTracker();
    
    // New cookies that are obtained during tracking
    this.newCookies = [];
  }
  
  /**
   * Try to track a package using multiple sources
   * @param {string} trackingNumber - The tracking number to look up
   * @param {string} courier - The courier service (ups, fedex, etc)
   * @returns {Promise<Object>} - Tracking information
   */
  async track(trackingNumber, courier = 'ups') {
    console.log(`MultiSourceTracker: Tracking ${trackingNumber} via ${courier}`);
    
    // Store errors for reporting
    const errors = [];
    
    // Try PackageRadar first
    try {
      console.log('Trying PackageRadar source...');
      const result = await this.packageRadarTracker.track(trackingNumber, courier);
      
      // Save cookies for future use
      if (this.packageRadarTracker.newCookies && this.packageRadarTracker.newCookies.length > 0) {
        this.newCookies = this.packageRadarTracker.newCookies;
      }
      
      // Check if we got meaningful results
      if (result && result.events && result.events.length > 0 && 
          result.deliveryStatus && result.deliveryStatus.status !== 'Status not found') {
        console.log('PackageRadar returned valid tracking data');
        return result;
      }
      
      // If we got empty or partial results, throw an error to try other sources
      console.log('PackageRadar returned incomplete data, trying alternatives...');
      errors.push({ source: 'PackageRadar', error: 'Incomplete data' });
    } catch (error) {
      console.error('PackageRadar tracking failed:', error.message);
      errors.push({ source: 'PackageRadar', error: error.message });
    }
    
    // Try direct API access to tracking service if available
    try {
      console.log(`Trying direct ${courier.toUpperCase()} API...`);
      const directResult = await this.tryDirectCourierAPI(trackingNumber, courier);
      if (directResult) {
        console.log(`Direct ${courier.toUpperCase()} API returned data`);
        return directResult;
      }
    } catch (error) {
      console.error(`Direct ${courier.toUpperCase()} API failed:`, error.message);
      errors.push({ source: `${courier.toUpperCase()} API`, error: error.message });
    }
    
    // Finally, use fallback
    try {
      console.log('Using fallback tracking data...');
      const fallbackResult = await this.fallbackTracker.track(trackingNumber, courier);
      
      // Add error information to the result
      fallbackResult.trackingErrors = errors;
      fallbackResult.message = `Used fallback tracking after ${errors.length} failed attempts`;
      
      return fallbackResult;
    } catch (error) {
      console.error('All tracking sources failed:', error.message);
      throw new Error(`All tracking sources failed: ${error.message}`);
    }
  }
  
  /**
   * Try to directly use a courier API if available
   */
  async tryDirectCourierAPI(trackingNumber, courier) {
    // This is a simplified implementation
    // In a real system, you would implement proper API calls to the courier's tracking API
    
    if (courier.toLowerCase() === 'ups') {
      try {
        // There is no public UPS API - this is just a template
        // You would need to sign up for their developer program
        // This is just an example of what the structure might look like
        console.log('UPS direct API not implemented - would require API key');
        
        /* Example of how it would work with a real API:
        const response = await axios.post('https://onlinetools.ups.com/track/v1/details/inquiry', {
          inquiryNumber: trackingNumber
        }, {
          headers: {
            'AccessLicenseNumber': process.env.UPS_ACCESS_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        // Transform the response into our standard format
        return {
          deliveryStatus: {
            status: response.data.trackResponse.shipment[0].package[0].currentStatus.description,
            date: response.data.trackResponse.shipment[0].package[0].activity[0].date,
            location: response.data.trackResponse.shipment[0].package[0].activity[0].location.city
          },
          events: response.data.trackResponse.shipment[0].package[0].activity.map(a => ({
            status: a.status.description,
            date: a.date,
            location: a.location.city
          }))
        };
        */
      } catch (error) {
        console.error('UPS API error:', error.message);
        return null;
      }
    }
    
    if (courier.toLowerCase() === 'fedex') {
      // Similar implementation for FedEx would go here
      console.log('FedEx direct API not implemented - would require API key');
    }
    
    // If we don't have a direct integration or it failed, return null
    return null;
  }
}

module.exports = { MultiSourceTracker };
