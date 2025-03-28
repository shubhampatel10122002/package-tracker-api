// PackageRadarTracker.js
const puppeteer = require('puppeteer');

class PackageRadarTracker {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default to headless: true
      timeout: options.timeout || 30000,    // Default timeout: 30 seconds
      saveScreenshot: false, // Always set to false
      saveHtml: false // Always set to false
    };
  }

  async track(trackingNumber, courier = 'ups') {
    const browser = await puppeteer.launch({
      headless: this.options.headless ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      
      // Set a reasonable viewport
      await page.setViewport({ width: 1366, height: 768 });
      
      // Navigate to the tracking URL
      const url = `https://packageradar.com/courier/${courier}/tracking/${trackingNumber}`;
      console.log(`Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });

      // Wait for the tracking information to load
      // First check if the content exists
      await page.waitForSelector('#fragment-checkpoints li', {
        timeout: this.options.timeout
      });

      // Screenshot and HTML saving is disabled

      // Extract the tracking information
      const result = await page.evaluate(() => {
        const result = {
          deliveryStatus: {
            status: 'Status not found',
            date: '',
            location: '',
            signedBy: ''
          },
          events: []
        };

        // Get the most recent status (first checkpoint)
        const firstCheckpoint = document.querySelector('#fragment-checkpoints li:first-child');
        if (firstCheckpoint) {
          result.deliveryStatus.status = firstCheckpoint.querySelector('.checkpoint-status')?.textContent.trim() || 'Status not found';
          
          // Get date
          const dateElement = firstCheckpoint.querySelector('time.datetime2');
          if (dateElement) {
            const dateAttr = dateElement.getAttribute('datetime');
            result.deliveryStatus.date = dateAttr ||
              `${dateElement.querySelector('span')?.textContent || ''} ${dateElement.textContent.split('\n').pop().trim()}`;
          }
          
          // Get location
          result.deliveryStatus.location = firstCheckpoint.querySelector('.text-muted')?.textContent.trim() || 'Location not found';
          
          // SignedBy is typically not shown on this page but we'll add it for compatibility
          result.deliveryStatus.signedBy = document.querySelector('.signed-by')?.textContent.trim() || 'Not specified';
        }

        // Extract all events
        const checkpoints = document.querySelectorAll('#fragment-checkpoints li');
        checkpoints.forEach(checkpoint => {
          const event = {
            status: checkpoint.querySelector('.checkpoint-status')?.textContent.trim() || 'Unknown',
            date: '',
            location: checkpoint.querySelector('.text-muted')?.textContent.trim() || ''
          };
          
          // Get date
          const dateElement = checkpoint.querySelector('time.datetime2');
          if (dateElement) {
            const dateAttr = dateElement.getAttribute('datetime');
            event.date = dateAttr ||
              `${dateElement.querySelector('span')?.textContent || ''} ${dateElement.textContent.split('\n').pop().trim()}`;
          }
          
          result.events.push(event);
        });

        return result;
      });

      await browser.close();
      return result;
    } catch (error) {
      // Make sure to close the browser even if there's an error
      if (browser) await browser.close();
      throw new Error(`PackageRadar tracking failed: ${error.message}`);
    }
  }
}

module.exports = { PackageRadarTracker };
