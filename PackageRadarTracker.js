// PackageRadarTracker.js
const puppeteer = require('puppeteer');

class PackageRadarTracker {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default to headless: true
      timeout: options.timeout || 30000, // Default timeout: 30 seconds
      saveScreenshot: false,
      saveHtml: false
    };
    
    // Store cookies if provided
    this.cookies = options.cookies || [];
    // Property to store newly obtained cookies during tracking
    this.newCookies = [];
  }

  async track(trackingNumber, courier = 'ups') {
    // Enhanced browser launch options for Docker environments
    const browser = await puppeteer.launch({
      headless: this.options.headless ? 'new' : false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Modify the navigator properties to avoid detection
      await page.evaluateOnNewDocument(() => {
        // Overwrite the 'webdriver' property to prevent detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Overwrite the plugins to include more than zero
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Add language
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Overwrite the permissions
        window.navigator.permissions.query = (parameters) => 
          parameters.name === 'notifications' 
            ? Promise.resolve({ state: Notification.permission }) 
            : Promise.resolve({ state: 'prompt' });
      });
      
      // Set user agent to a common one
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
      
      // Set a reasonable viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set cookies if available
      if (this.cookies && this.cookies.length > 0) {
        console.log(`Setting ${this.cookies.length} cookies for request`);
        await page.setCookie(...this.cookies);
      }
      
      // Set extra HTTP headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // Navigate to the tracking URL
      const url = `https://packageradar.com/courier/${courier}/tracking/${trackingNumber}`;
      console.log(`Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });
      
      // Check for Cloudflare challenge
      if (await this.isCloudflareChallenge(page)) {
        console.log('Detected Cloudflare challenge, waiting to solve...');
        await this.handleCloudflareChallenge(page);
      }

      // Try multiple selector patterns (sites sometimes change their structure)
      const selectors = [
        '#fragment-checkpoints li', 
        '.checkpoint-item', 
        '.tracking-event', 
        '.tracking-history li',
        '.tracking-details li'
      ];
      
      let foundSelector = false;
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, {
            timeout: 10000 // Shorter timeout for each selector
          });
          console.log(`Found selector: ${selector}`);
          foundSelector = true;
          break;
        } catch (error) {
          console.log(`Selector ${selector} not found`);
        }
      }
      
      if (!foundSelector) {
        throw new Error('Could not find any tracking information on the page');
      }

      // Save screenshot and HTML if requested
      if (this.options.saveScreenshot) {
        await page.screenshot({ path: 'packageradar-page.png' });
        console.log('Screenshot saved to packageradar-page.png');
      }

      if (this.options.saveHtml) {
        const html = await page.content();
        require('fs').writeFileSync('packageradar-page.html', html);
        console.log('HTML saved to packageradar-page.html');
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

      await browser.close();
      return result;
    } catch (error) {
      // Make sure to close the browser even if there's an error
      if (browser) await browser.close();
      throw new Error(`PackageRadar tracking failed: ${error.message}`);
    }
  }
}

  // Helper method to check if the page has a Cloudflare challenge
  async isCloudflareChallenge(page) {
    try {
      const title = await page.title();
      const content = await page.content();
      return title.includes('Attention Required') || 
             title.includes('Just a moment') || 
             content.includes('cf-browser-verification') ||
             content.includes('challenge-form');
    } catch (error) {
      console.error('Error checking for Cloudflare challenge:', error);
      return false;
    }
  }

  // Handle Cloudflare challenge
  async handleCloudflareChallenge(page) {
    try {
      // First, try waiting for the challenge to resolve itself
      // Some Cloudflare challenges will automatically pass after a delay
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000 
      }).catch(e => console.log('Initial navigation wait timed out, continuing...'));
      
      // Check if there's a captcha or verification button to click
      const selectors = [
        '#challenge-stage input[type="button"]', 
        '.ray_id', 
        '.cf-confirm-button',
        'input[type="submit"]',
        'button[type="submit"]'
      ];
      
      for (const selector of selectors) {
        const exists = await page.$(selector);
        if (exists) {
          console.log(`Found Cloudflare selector: ${selector}`);
          await page.click(selector).catch(e => console.log(`Error clicking ${selector}:`, e.message));
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          }).catch(e => console.log('Click navigation wait timed out, continuing...'));
          break;
        }
      }
      
      // Wait a bit longer to let any remaining processes complete
      await page.waitForTimeout(5000);
      
      // Check again if we're still on the challenge page
      if (await this.isCloudflareChallenge(page)) {
        console.log('Still on Cloudflare challenge page after attempt to solve');
      } else {
        console.log('Successfully passed Cloudflare challenge');
      }
    } catch (error) {
      console.error('Error handling Cloudflare challenge:', error);
    }
  }
}

module.exports = { PackageRadarTracker };
