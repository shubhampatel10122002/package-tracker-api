// PackageRadarTracker.js
const puppeteer = require('puppeteer');

class PackageRadarTracker {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default to headless: true
      timeout: options.timeout || 30000,    // Default timeout: 30 seconds
      saveScreenshot: false,
      saveHtml: false
    };
  }

  async track(trackingNumber, courier = 'ups') {
    console.log(`Starting browser with headless: ${this.options.headless ? 'new' : false}`);
    
    // Enhanced browser configuration for Docker environments
    const browser = await puppeteer.launch({
      headless: this.options.headless ? 'new' : false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process', // Helps with some websites that have iframe issues
        '--disable-web-security',                            // Helps with cross-origin issues
        '--disable-features=site-per-process'
      ],
      ignoreHTTPSErrors: true                               // Ignore HTTPS errors
    });

    try {
      const page = await browser.newPage();
      
      // Set user agent to appear more like a regular browser
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set a reasonable viewport
      await page.setViewport({ width: 1366, height: 768 });
      
      // Add more logging for debugging
      page.on('console', msg => console.log('Browser console:', msg.text()));
      
      // Navigate to the tracking URL
      const url = `https://packageradar.com/courier/${courier}/tracking/${trackingNumber}`;
      console.log(`Navigating to: ${url}`);
      
      // Try to detect navigation issues
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });
      console.log(`Page loaded with status: ${response.status()}`);
      
      // Take a screenshot regardless of saveScreenshot option for debugging
      // This will be saved in the container but can help for debugging
      try {
        await page.screenshot({ path: '/tmp/debug-page.png' });
        console.log('Debug screenshot saved');
      } catch (err) {
        console.log('Could not save debug screenshot:', err.message);
      }

      // Log the page content for debugging
      const pageContent = await page.content();
      console.log(`Page content length: ${pageContent.length} characters`);
      console.log(`Page title: ${await page.title()}`);

      // Wait for the tracking information to load with more detailed logging
      console.log(`Waiting for selector: #fragment-checkpoints li (timeout: ${this.options.timeout}ms)`);
      try {
        await page.waitForSelector('#fragment-checkpoints li', {
          timeout: this.options.timeout
        });
        console.log('Selector found successfully');
      } catch (err) {
        console.log(`Selector wait failed: ${err.message}`);
        
        // Try to find if there are any checkpoints with a different pattern
        const alternativeSelectors = [
          '.checkpoint-item', 
          '.tracking-event', 
          '.tracking-history li',
          '.tracking-details li'
        ];
        
        for (const selector of alternativeSelectors) {
          try {
            const exists = await page.evaluate((sel) => {
              return document.querySelector(sel) !== null;
            }, selector);
            
            if (exists) {
              console.log(`Found alternative selector: ${selector}`);
              // Continue with alternative selector...
              break;
            }
          } catch (e) {
            // Just continue trying other selectors
          }
        }
        
        // If we get here and didn't break, we couldn't find any alternative
        throw err; // Re-throw the original error
      }

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

      console.log(`Successfully extracted ${result.events.length} tracking events`);
      await browser.close();
      return result;
    } catch (error) {
      console.error('Error in tracking:', error);
      
      // Take a screenshot of the error state if possible
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({ path: '/tmp/error-page.png' });
          console.log('Error screenshot saved');
        }
      } catch (screenshotError) {
        console.log('Could not save error screenshot');
      }
      
      // Make sure to close the browser even if there's an error
      if (browser) {
        await browser.close();
        console.log('Browser closed');
      }
      
      throw new Error(`PackageRadar tracking failed: ${error.message}`);
    }
  }
}

module.exports = { PackageRadarTracker };
