// Add to cloudflare-bypass.js - Enhanced Cloudflare handling

// Add stealth plugin support
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const puppeteerExtra = require('puppeteer-extra');

// Configure stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * Attempts to bypass Cloudflare protection with enhanced stealth techniques
 * @param {string} url - The URL to visit and bypass Cloudflare on
 * @param {string} cookiesPath - Path to save cookies to
 * @returns {Promise<Array>} - The cookies that were captured
 */
async function bypassCloudflareEnhanced(url, cookiesPath = './cookies.json') {
  console.log(`Attempting to bypass Cloudflare protection using enhanced stealth for: ${url}`);
  
  // Check if we're in a container without display
  const isContainer = process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV === 'true';
  
  const launchOptions = {
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--headless=new',
      '--disable-infobars',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--single-process',
      '--no-zygote'
    ],
    ignoreHTTPSErrors: true,
    dumpio: true 
  };
  
  try {
    // Use puppeteer-extra with stealth plugin
    const browser = await puppeteerExtra.launch(launchOptions);
    
    try {
      const page = await browser.newPage();
      
      // Use a more realistic user agent
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
      ];
      
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUserAgent);
      console.log(`Using user agent: ${randomUserAgent}`);
      
      // Add extra browser fingerprinting protections
      await page.evaluateOnNewDocument(() => {
        // Overwrite navigator properties
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        navigator.__proto__ = newProto;
        
        // Add Chrome-specific properties
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
        
        // Create detailed plugin array
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            return [
              {
                0: { type: 'application/pdf' },
                description: 'Portable Document Format',
                filename: 'internal-pdf-viewer',
                length: 1,
                name: 'PDF Viewer'
              },
              {
                0: { type: 'application/pdf' },
                description: 'Portable Document Format',
                filename: 'internal-pdf-viewer',
                length: 1,
                name: 'Chrome PDF Viewer'
              }
            ];
          }
        });
        
        // Add authentic languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'es'],
        });
        
        // Add audio/video input devices
        if (navigator.mediaDevices) {
          navigator.mediaDevices.enumerateDevices = async () => [
            {
              deviceId: 'default',
              kind: 'audioinput',
              label: 'Default',
              groupId: 'default'
            },
            {
              deviceId: 'default',
              kind: 'videoinput',
              label: 'Default',
              groupId: 'default'
            }
          ];
        }
      });
      
      // Set hardware concurrency to a realistic value
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8
        });
      });
      
      // Set a realistic viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });
      
      // Set extra HTTP headers to appear more like a real browser
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
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not-A.Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      });
      
      // Add artificial delays to mimic human browsing patterns
      await page.setDefaultNavigationTimeout(60000);
      
      // Add existing cookies if available
      try {
        const cookiesJson = await fs.readFile(cookiesPath, 'utf-8');
        const cookies = JSON.parse(cookiesJson);
        if (cookies && cookies.length > 0) {
          await page.setCookie(...cookies);
          console.log(`Set ${cookies.length} existing cookies`);
        }
      } catch (error) {
        console.log('No existing cookies found or error loading cookies');
      }
      
      // Random delay before navigation (200-500ms)
      await page.evaluate(() => new Promise(r => setTimeout(r, 200 + Math.floor(Math.random() * 300))));
      
      // Go to the URL with realistic navigation timing
      console.log(`Navigating to ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Check for Cloudflare challenge
      let isChallengePresent = await isCloudflareChallenge(page);
      
      if (isChallengePresent) {
        console.log('Cloudflare challenge detected, waiting to solve...');
        
        // Try multiple approaches to solve the challenge
        
        // 1. Wait longer for auto-solve (8-12 seconds)
        const waitTime = 8000 + Math.floor(Math.random() * 4000);
        console.log(`Waiting ${waitTime}ms for auto-solve...`);
        await page.waitForTimeout(waitTime);
        
        // 2. Try clicking any visible buttons
        try {
          const buttonClicked = await clickVisibleButtons(page);
          if (buttonClicked) {
            // Wait for navigation after button click
            await page.waitForNavigation({ 
              waitUntil: 'networkidle2',
              timeout: 30000
            }).catch(e => console.log('Navigation after button click timed out'));
          }
        } catch (err) {
          console.log('No buttons to click or error clicking buttons', err.message);
        }
        
        // 3. Simulate mouse movements
        await simulateHumanBehavior(page);
        
        // Check again after waiting and interactions
        isChallengePresent = await isCloudflareChallenge(page);
        
        if (isChallengePresent) {
          console.log('Still on Cloudflare challenge page. Trying additional techniques...');
          
          // 4. Directly inject cookies if known format
          try {
            await injectCloudflareCookies(page);
          } catch (err) {
            console.log('Error injecting Cloudflare cookies:', err.message);
          }
          
          // Wait a bit more
          await page.waitForTimeout(5000);
          
          // Check once more
          isChallengePresent = await isCloudflareChallenge(page);
          if (isChallengePresent) {
            console.log('Unable to bypass Cloudflare challenge automatically.');
          } else {
            console.log('Successfully passed Cloudflare challenge after additional techniques');
          }
        } else {
          console.log('Successfully passed Cloudflare challenge');
        }
      } else {
        console.log('No Cloudflare challenge detected or it was bypassed immediately');
      }
      
      // Take a screenshot to troubleshoot (optional)
      if (process.env.SAVE_DEBUG_SCREENSHOTS === 'true') {
        await page.screenshot({ path: 'cloudflare-page.png' });
        console.log('Saved debug screenshot to cloudflare-page.png');
      }
      
      // Get cookies to save
      const cookies = await page.cookies();
      
      // Save cookies to file
      await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
      console.log(`Cookies saved to ${cookiesPath} (${cookies.length} cookies)`);
      
      // Save page content for debugging if needed
      if (process.env.SAVE_DEBUG_HTML === 'true') {
        await fs.writeFile('page-content.html', await page.content());
        console.log('Saved page content for debugging');
      }
      
      await browser.close();
      return cookies;
    } catch (pageError) {
      console.error('Page error:', pageError);
      await browser.close();
      throw pageError;
    }
  } catch (browserError) {
    console.error('Failed to launch browser:', browserError);
    
    // Return empty cookies array if browser launch fails
    console.log('Using empty cookies as fallback due to browser launch failure');
    await fs.writeFile(cookiesPath, JSON.stringify([], null, 2));
    return [];
  }
}

/**
 * Simulate human-like behavior on the page
 */
async function simulateHumanBehavior(page) {
  try {
    // Perform random mouse movements
    console.log('Simulating human behavior...');
    
    await page.evaluate(() => {
      // Simulate mouse movements
      const moveCount = 5 + Math.floor(Math.random() * 10);
      for (let i = 0; i < moveCount; i++) {
        const x = Math.floor(Math.random() * window.innerWidth);
        const y = Math.floor(Math.random() * window.innerHeight);
        
        // Create and dispatch a mouse event
        const event = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        document.dispatchEvent(event);
      }
      
      // Scroll a bit
      const scrollCount = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < scrollCount; i++) {
        const scrollY = 100 + Math.floor(Math.random() * 400);
        window.scrollBy(0, scrollY);
      }
    });
    
    // Add some random delays
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 2000));
  } catch (error) {
    console.log('Error during human behavior simulation:', error.message);
  }
}

/**
 * Try to inject known Cloudflare cookie formats directly
 */
async function injectCloudflareCookies(page) {
  try {
    await page.evaluate(() => {
      // Try to set common Cloudflare cookies
      const now = new Date();
      const expiry = new Date(now.getTime() + 86400 * 1000); // 1 day
      
      // cf_clearance is the main protection cookie
      document.cookie = `cf_clearance=bypass.${Math.random().toString(36).substring(2)}.${now.getTime()}; expires=${expiry.toUTCString()}; path=/; domain=.packageradar.com; Secure; SameSite=None`;
      
      // Some sites also use these
      document.cookie = `__cf_bm=${Math.random().toString(36).substring(2)}; expires=${expiry.toUTCString()}; path=/; domain=.packageradar.com; Secure; SameSite=None`;
    });
    
    // Reload page after injecting cookies
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  } catch (error) {
    console.log('Error injecting Cloudflare cookies:', error.message);
  }
}

// Replace the original bypassCloudflare function with the enhanced version
const originalBypassCloudflare = bypassCloudflare;
module.exports.bypassCloudflare = bypassCloudflareEnhanced;

// Or add as a new function
module.exports.bypassCloudflareEnhanced = bypassCloudflareEnhanced;
module.exports.simulateHumanBehavior = simulateHumanBehavior;
// // cloudflare-bypass.js
// const puppeteer = require('puppeteer');
// const fs = require('fs').promises;
// const path = require('path');

// /**
//  * Attempts to bypass Cloudflare protection and store cookies for reuse
//  * @param {string} url - The URL to visit and bypass Cloudflare on
//  * @param {string} cookiesPath - Path to save cookies to
//  * @returns {Promise<Array>} - The cookies that were captured
//  */
// // Modified bypassCloudflare function to work in container environments
// // Add to cloudflare-bypass.js

// /**
//  * Attempts to bypass Cloudflare protection and store cookies for reuse
//  * @param {string} url - The URL to visit and bypass Cloudflare on
//  * @param {string} cookiesPath - Path to save cookies to
//  * @returns {Promise<Array>} - The cookies that were captured
//  */
// async function bypassCloudflare(url, cookiesPath = './cookies.json') {
//     console.log(`Attempting to bypass Cloudflare protection for: ${url}`);
    
//     // Check if we're in a container without display - use truly headless mode
//     const isContainer = process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV === 'true';
    
//     const launchOptions = {
//       // Force new headless mode
//       headless: "new",
//       executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-accelerated-2d-canvas',
//         '--disable-gpu',
//         '--window-size=1920,1080',
//         '--disable-blink-features=AutomationControlled',
//         '--headless=new',
//         '--disable-infobars',
//         '--hide-scrollbars',
//         '--mute-audio',
//         // These additional flags help with container environments
//         '--disable-software-rasterizer',
//         '--disable-extensions',
//         '--single-process',
//         '--no-zygote'
//       ],
//       ignoreHTTPSErrors: true,
//       dumpio: true // For debugging - logs Chrome output
//     };
    
//     // Add a try/catch to handle browser launch failures
//     try {
//       const browser = await puppeteer.launch(launchOptions);
      
//       try {
//         const page = await browser.newPage();
        
//         // Set a realistic user agent
//         await page.setUserAgent(
//           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
//         );
        
//         // Modify navigator properties to evade bot detection
//         await page.evaluateOnNewDocument(() => {
//           // Overwrite the 'webdriver' property
//           Object.defineProperty(navigator, 'webdriver', {
//             get: () => false,
//           });
          
//           // Create fake plugins
//           Object.defineProperty(navigator, 'plugins', {
//             get: () => [
//               {
//                 0: {type: 'application/pdf'},
//                 name: 'Chrome PDF Plugin',
//                 description: 'Portable Document Format',
//                 filename: 'internal-pdf-viewer'
//               },
//               {
//                 0: {type: 'application/pdf'},
//                 name: 'Chrome PDF Viewer',
//                 description: 'Portable Document Format',
//                 filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'
//               },
//               {
//                 0: {type: 'application/x-google-chrome-pdf'},
//                 name: 'PDF Viewer',
//                 description: 'Portable Document Format',
//                 filename: 'internal-pdf-viewer'
//               }
//             ],
//           });
          
//           // Override language settings
//           Object.defineProperty(navigator, 'languages', {
//             get: () => ['en-US', 'en'],
//           });
          
//           // Set platform
//           Object.defineProperty(navigator, 'platform', {
//             get: () => 'Win32',
//           });
          
//           // Fake permissions behavior
//           if (window.navigator.permissions) {
//             window.navigator.permissions.query = (parameters) => 
//               parameters.name === 'notifications' 
//                 ? Promise.resolve({ state: Notification.permission }) 
//                 : Promise.resolve({ state: 'prompt' });
//           }
//         });
        
//         // Set extra HTTP headers
//         await page.setExtraHTTPHeaders({
//           'Accept-Language': 'en-US,en;q=0.9',
//           'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
//           'Accept-Encoding': 'gzip, deflate, br',
//           'Connection': 'keep-alive',
//           'Cache-Control': 'max-age=0',
//           'Upgrade-Insecure-Requests': '1',
//           'Sec-Fetch-Dest': 'document',
//           'Sec-Fetch-Mode': 'navigate',
//           'Sec-Fetch-Site': 'none',
//           'Sec-Fetch-User': '?1'
//         });
        
//         try {
//           // Go to the URL
//           console.log(`Navigating to ${url}`);
//           await page.goto(url, {
//             waitUntil: 'networkidle2',
//             timeout: 60000
//           });
          
//           // Check for Cloudflare challenge
//           let isChallengePresent = await isCloudflareChallenge(page);
          
//           if (isChallengePresent) {
//             console.log('Cloudflare challenge detected, waiting to solve...');
            
//             // Wait longer for Cloudflare to clear
//             await page.waitForTimeout(10000);
            
//             // Try to click any visible buttons
//             try {
//               await clickVisibleButtons(page);
//             } catch (err) {
//               console.log('No buttons to click or error clicking buttons', err.message);
//             }
            
//             // Wait for navigation to complete after possible button click
//             await page.waitForNavigation({ 
//               waitUntil: 'networkidle2',
//               timeout: 30000
//             }).catch(e => console.log('Navigation after button click timed out'));
            
//             // Check again after waiting
//             isChallengePresent = await isCloudflareChallenge(page);
            
//             if (isChallengePresent) {
//               console.log('Still on Cloudflare challenge page. Manual intervention may be needed.');
              
//               // Waiting longer for manual intervention if not in container mode
//               if (!isContainer) {
//                 await page.waitForTimeout(60000);
//               }
//             } else {
//               console.log('Successfully passed Cloudflare challenge');
//             }
//           } else {
//             console.log('No Cloudflare challenge detected or it was bypassed immediately');
//           }
          
//           // Get cookies to save
//           const cookies = await page.cookies();
          
//           // Save cookies to file
//           await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
//           console.log(`Cookies saved to ${cookiesPath}`);
          
//           await browser.close();
//           return cookies;
//         } catch (navError) {
//           console.error('Navigation error:', navError);
//           await browser.close();
//           throw navError;
//         }
//       } catch (pageError) {
//         console.error('Page error:', pageError);
//         await browser.close();
//         throw pageError;
//       }
//     } catch (browserError) {
//       console.error('Failed to launch browser:', browserError);
      
//       // Return empty cookies array if browser launch fails
//       console.log('Using empty cookies as fallback due to browser launch failure');
//       await fs.writeFile(cookiesPath, JSON.stringify([], null, 2));
//       return [];
//     }
//   }
  
//   /**
//    * Load cookies from file and use them for requests
//    * Modified to handle browser launch failures more gracefully
//    */
//   async function loadAndUseCookies(url, cookiesPath = './cookies.json') {
//     try {
//       // Check if cookies file exists
//       try {
//         await fs.access(cookiesPath);
//       } catch (error) {
//         console.log('No cookies file found, creating one by bypassing Cloudflare');
//         try {
//           return await bypassCloudflare(url, cookiesPath);
//         } catch (bypassError) {
//           console.error('Bypass error, using empty cookies:', bypassError.message);
//           await fs.writeFile(cookiesPath, JSON.stringify([], null, 2));
//           return [];
//         }
//       }
      
//       // Load cookies from file
//       const cookiesJson = await fs.readFile(cookiesPath, 'utf-8');
//       const cookies = JSON.parse(cookiesJson);
      
//       if (!cookies || cookies.length === 0) {
//         console.log('Cookies file exists but is empty, bypassing Cloudflare');
//         try {
//           return await bypassCloudflare(url, cookiesPath);
//         } catch (bypassError) {
//           console.error('Bypass error after empty cookies, using empty cookies:', bypassError.message);
//           return [];
//         }
//       }
      
//       console.log(`Loaded ${cookies.length} cookies from file`);
//       return cookies;
//     } catch (error) {
//       console.error('Error loading cookies:', error);
//       // If there's an error with the cookies file, try bypassing again
//       try {
//         return await bypassCloudflare(url, cookiesPath);
//       } catch (bypassError) {
//         console.error('Bypass error after loading error, using empty cookies:', bypassError.message);
//         await fs.writeFile(cookiesPath, JSON.stringify([], null, 2));
//         return [];
//       }
//     }
//   }

// /**
//  * Checks if the current page has a Cloudflare challenge
//  */
// async function isCloudflareChallenge(page) {
//   try {
//     const title = await page.title();
//     const content = await page.content();
    
//     return title.includes('Attention Required') || 
//            title.includes('Just a moment') || 
//            content.includes('cf-browser-verification') ||
//            content.includes('challenge-form') ||
//            content.includes('turnstile');
//   } catch (error) {
//     console.error('Error checking for Cloudflare challenge:', error);
//     return false;
//   }
// }

// /**
//  * Attempts to click any visible buttons on the page that might be part of the challenge
//  */
// async function clickVisibleButtons(page) {
//   // Define selectors for various buttons that might be present
//   const buttonSelectors = [
//     'button[type="submit"]',
//     'input[type="submit"]',
//     '.cf-submit',
//     '.cf-button',
//     '.challenge-button',
//     '.button-submit',
//     '.cf-submit-button',
//     '.big-button',
//     '.submit',
//     '#challenge-form button'
//   ];
  
//   for (const selector of buttonSelectors) {
//     try {
//       const buttonExists = await page.$(selector);
//       if (buttonExists) {
//         console.log(`Found button with selector: ${selector}`);
//         await page.click(selector);
//         console.log(`Clicked button with selector: ${selector}`);
//         // Wait a bit after clicking
//         await page.waitForTimeout(5000);
//         return true;
//       }
//     } catch (error) {
//       console.log(`Error with selector ${selector}:`, error.message);
//     }
//   }
  
//   return false;
// }



// module.exports = {
//   bypassCloudflare,
//   loadAndUseCookies,
//   isCloudflareChallenge
// };
