// cloudflare-bypass.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Attempts to bypass Cloudflare protection and store cookies for reuse
 * @param {string} url - The URL to visit and bypass Cloudflare on
 * @param {string} cookiesPath - Path to save cookies to
 * @returns {Promise<Array>} - The cookies that were captured
 */
async function bypassCloudflare(url, cookiesPath = './cookies.json') {
  console.log(`Attempting to bypass Cloudflare protection for: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: false, // Using headed mode helps evade detection
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreHTTPSErrors: true
  });

  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );
    
    // Modify navigator properties to evade bot detection
    await page.evaluateOnNewDocument(() => {
      // Overwrite the 'webdriver' property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Create fake plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: 'application/pdf'},
            name: 'Chrome PDF Plugin',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer'
          },
          {
            0: {type: 'application/pdf'},
            name: 'Chrome PDF Viewer',
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'
          },
          {
            0: {type: 'application/x-google-chrome-pdf'},
            name: 'PDF Viewer',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer'
          }
        ],
      });
      
      // Override language settings
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Set platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });
      
      // Fake permissions behavior
      window.navigator.permissions.query = (parameters) => 
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission }) 
          : Promise.resolve({ state: 'prompt' });
    });
    
    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });
    
    // Go to the URL
    console.log(`Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Check for Cloudflare challenge
    let isChallengePresent = await isCloudflareChallenge(page);
    
    if (isChallengePresent) {
      console.log('Cloudflare challenge detected, waiting to solve...');
      
      // Wait longer for Cloudflare to clear
      await page.waitForTimeout(10000);
      
      // Try to click any visible buttons
      try {
        await clickVisibleButtons(page);
      } catch (err) {
        console.log('No buttons to click or error clicking buttons', err.message);
      }
      
      // Wait for navigation to complete after possible button click
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000
      }).catch(e => console.log('Navigation after button click timed out'));
      
      // Check again after waiting
      isChallengePresent = await isCloudflareChallenge(page);
      
      if (isChallengePresent) {
        console.log('Still on Cloudflare challenge page. Manual intervention may be needed.');
        
        // Waiting longer for manual intervention if running in headed mode
        await page.waitForTimeout(60000);
      } else {
        console.log('Successfully passed Cloudflare challenge');
      }
    } else {
      console.log('No Cloudflare challenge detected or it was bypassed immediately');
    }
    
    // Get cookies to save
    const cookies = await page.cookies();
    
    // Save cookies to file
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`Cookies saved to ${cookiesPath}`);
    
    return cookies;
  } catch (error) {
    console.error('Error bypassing Cloudflare:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Checks if the current page has a Cloudflare challenge
 */
async function isCloudflareChallenge(page) {
  try {
    const title = await page.title();
    const content = await page.content();
    
    return title.includes('Attention Required') || 
           title.includes('Just a moment') || 
           content.includes('cf-browser-verification') ||
           content.includes('challenge-form') ||
           content.includes('turnstile');
  } catch (error) {
    console.error('Error checking for Cloudflare challenge:', error);
    return false;
  }
}

/**
 * Attempts to click any visible buttons on the page that might be part of the challenge
 */
async function clickVisibleButtons(page) {
  // Define selectors for various buttons that might be present
  const buttonSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    '.cf-submit',
    '.cf-button',
    '.challenge-button',
    '.button-submit',
    '.cf-submit-button',
    '.big-button',
    '.submit',
    '#challenge-form button'
  ];
  
  for (const selector of buttonSelectors) {
    try {
      const buttonExists = await page.$(selector);
      if (buttonExists) {
        console.log(`Found button with selector: ${selector}`);
        await page.click(selector);
        console.log(`Clicked button with selector: ${selector}`);
        // Wait a bit after clicking
        await page.waitForTimeout(5000);
        return true;
      }
    } catch (error) {
      console.log(`Error with selector ${selector}:`, error.message);
    }
  }
  
  return false;
}

/**
 * Load cookies from file and use them for requests
 */
async function loadAndUseCookies(url, cookiesPath = './cookies.json') {
  try {
    // Check if cookies file exists
    try {
      await fs.access(cookiesPath);
    } catch (error) {
      console.log('No cookies file found, creating one by bypassing Cloudflare');
      return await bypassCloudflare(url, cookiesPath);
    }
    
    // Load cookies from file
    const cookiesJson = await fs.readFile(cookiesPath, 'utf-8');
    const cookies = JSON.parse(cookiesJson);
    
    if (!cookies || cookies.length === 0) {
      console.log('Cookies file exists but is empty, bypassing Cloudflare');
      return await bypassCloudflare(url, cookiesPath);
    }
    
    console.log(`Loaded ${cookies.length} cookies from file`);
    return cookies;
  } catch (error) {
    console.error('Error loading cookies:', error);
    // If there's an error with the cookies file, try bypassing again
    return await bypassCloudflare(url, cookiesPath);
  }
}

module.exports = {
  bypassCloudflare,
  loadAndUseCookies,
  isCloudflareChallenge
};
