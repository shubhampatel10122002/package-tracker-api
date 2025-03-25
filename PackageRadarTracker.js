// Modified version of PackageRadarTracker.js with enhanced error handling
// and improved browser launch options

const puppeteer = require('puppeteer');

class PackageRadarTracker {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default to headless: true
      timeout: options.timeout || 30000, // Default timeout: 30 seconds
      saveScreenshot: options.saveScreenshot || false,
      saveHtml: options.saveHtml || false,
      maxRetries: options.maxRetries || 2 // Add retry capability
    };
    
    // Store cookies if provided
    this.cookies = options.cookies || [];
    // Property to store newly obtained cookies during tracking
    this.newCookies = [];
  }

  async track(trackingNumber, courier = 'ups') {
    let browser = null;
    let retries = 0;
    
    while (retries <= this.options.maxRetries) {
      try {
        // Enhanced browser launch options for container environments
        browser = await puppeteer.launch({
          headless: "new", // Force headless new mode
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          ignoreHTTPSErrors: true,
          dumpio: true, // For debugging - logs Chrome output
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--headless=new',
            '--disable-infobars',
            '--hide-scrollbars',
            '--mute-audio',
            // Add cache directory arguments if environment variables are set
            ...(process.env.CHROME_USER_DATA_DIR ? [`--user-data-dir=${process.env.CHROME_USER_DATA_DIR}`] : []),
            ...(process.env.CHROME_CACHE_DIR ? [`--disk-cache-dir=${process.env.CHROME_CACHE_DIR}`] : []),
          ]
        });

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
          if (window.navigator.permissions) {
            window.navigator.permissions.query = (parameters) => 
              parameters.name === 'notifications' 
                ? Promise.resolve({ state: Notification.permission }) 
                : Promise.resolve({ state: 'prompt' });
          }
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
          // Fallback to basic content check
          const content = await page.content();
          if (content.includes('tracking') || content.includes('shipment') || content.includes('delivery')) {
            console.log('Page loaded but no tracking selectors found. Using basic extraction.');
          } else {
            throw new Error('Could not find any tracking information on the page');
          }
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

          // Check different possible selectors for the checkpoints
          const possibleSelectors = [
            '#fragment-checkpoints li',
            '.checkpoint-item',
            '.tracking-event',
            '.tracking-history li',
            '.tracking-details li'
          ];
          
          let checkpoints = null;
          for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              checkpoints = elements;
              break;
            }
          }
          
          if (!checkpoints || checkpoints.length === 0) {
            // Try basic content extraction if no structured data found
            const mainContent = document.querySelector('main') || document.body;
            const textContent = mainContent.textContent;
            
            if (textContent.includes('delivered') || textContent.includes('Delivered')) {
              result.deliveryStatus.status = 'Delivered';
            } else if (textContent.includes('transit') || textContent.includes('Transit')) {
              result.deliveryStatus.status = 'In Transit';
            } else if (textContent.includes('processed') || textContent.includes('Processing')) {
              result.deliveryStatus.status = 'Processing';
            }
            
            return result;
          }

          // Get the most recent status (first checkpoint)
          const firstCheckpoint = checkpoints[0];
          if (firstCheckpoint) {
            // Try different selectors for status
            const statusSelectors = ['.checkpoint-status', '.status', '.event-status', '.tracking-status'];
            for (const selector of statusSelectors) {
              const statusElement = firstCheckpoint.querySelector(selector);
              if (statusElement) {
                result.deliveryStatus.status = statusElement.textContent.trim();
                break;
              }
            }

            // Get date - try different possible selectors
            const dateSelectors = ['time.datetime2', '.date', '.event-date', '.tracking-date'];
            for (const selector of dateSelectors) {
              const dateElement = firstCheckpoint.querySelector(selector);
              if (dateElement) {
                const dateAttr = dateElement.getAttribute('datetime');
                if (dateAttr) {
                  result.deliveryStatus.date = dateAttr;
                } else {
                  const span = dateElement.querySelector('span');
                  const spanText = span ? span.textContent : '';
                  const restText = dateElement.textContent.split('\n').pop().trim();
                  result.deliveryStatus.date = `${spanText} ${restText}`.trim();
                }
                break;
              }
            }

            // Get location - try different possible selectors
            const locationSelectors = ['.text-muted', '.location', '.event-location', '.tracking-location'];
            for (const selector of locationSelectors) {
              const locationElement = firstCheckpoint.querySelector(selector);
              if (locationElement) {
                result.deliveryStatus.location = locationElement.textContent.trim();
                break;
              }
            }

            // SignedBy is typically not shown on this page but we'll add it for compatibility
            const signedBySelectors = ['.signed-by', '.signature', '.recipient'];
            for (const selector of signedBySelectors) {
              const signedByElement = document.querySelector(selector);
              if (signedByElement) {
                result.deliveryStatus.signedBy = signedByElement.textContent.trim();
                break;
              }
            }
          }

          // Extract all events
          if (checkpoints.length > 0) {
            checkpoints.forEach(checkpoint => {
              const event = {
                status: 'Unknown',
                date: '',
                location: ''
              };
    
              // Try different selectors for status
              const statusSelectors = ['.checkpoint-status', '.status', '.event-status', '.tracking-status'];
              for (const selector of statusSelectors) {
                const statusElement = checkpoint.querySelector(selector);
                if (statusElement) {
                  event.status = statusElement.textContent.trim();
                  break;
                }
              }
    
              // Get date - try different possible selectors
              const dateSelectors = ['time.datetime2', '.date', '.event-date', '.tracking-date'];
              for (const selector of dateSelectors) {
                const dateElement = checkpoint.querySelector(selector);
                if (dateElement) {
                  const dateAttr = dateElement.getAttribute('datetime');
                  if (dateAttr) {
                    event.date = dateAttr;
                  } else {
                    const span = dateElement.querySelector('span');
                    const spanText = span ? span.textContent : '';
                    const restText = dateElement.textContent.split('\n').pop().trim();
                    event.date = `${spanText} ${restText}`.trim();
                  }
                  break;
                }
              }
    
              // Get location - try different possible selectors
              const locationSelectors = ['.text-muted', '.location', '.event-location', '.tracking-location'];
              for (const selector of locationSelectors) {
                const locationElement = checkpoint.querySelector(selector);
                if (locationElement) {
                  event.location = locationElement.textContent.trim();
                  break;
                }
              }
    
              result.events.push(event);
            });
          }

          return result;
        });

        // Store any new cookies for future use
        this.newCookies = await page.cookies();

        await browser.close();
        browser = null;
        
        // Add tracking meta info
        result.trackingNumber = trackingNumber;
        result.courier = courier;
        
        return result;
      } catch (error) {
        retries++;
        console.error(`Attempt ${retries}/${this.options.maxRetries + 1} failed: ${error.message}`);
        
        // Close browser if it's still open
        if (browser) {
          try {
            // Take an error screenshot if available
            const pages = await browser.pages().catch(e => []);
            if (pages.length > 0) {
              await pages[0].screenshot({ path: `error-screenshot-${retries}.png` })
                .catch(e => console.error('Error taking screenshot:', e.message));
              console.log(`Error screenshot saved (attempt ${retries})`);
            }
            await browser.close().catch(e => console.error('Error closing browser:', e.message));
            browser = null;
          } catch (closeError) {
            console.error('Error during cleanup:', closeError.message);
          }
        }
        
        // On last retry, throw the error
        if (retries > this.options.maxRetries) {
          throw new Error(`PackageRadar tracking failed after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
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
      // Using evaluate for setTimeout since waitForTimeout might not be available
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
      
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
