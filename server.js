// Updated server.js to use the new MultiSourceTracker

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { PackageRadarTracker } = require('./PackageRadarTracker');
const { FallbackTracker } = require('./fallback-tracker');
const { MultiSourceTracker } = require('./multi-source-tracker');
const { loadAndUseCookies, bypassCloudflareEnhanced } = require('./cloudflare-bypass');
const fs = require('fs').promises;
const path = require('path');

// Allow explicit control over fallback mode using environment variable
const USE_FALLBACK = process.env.USE_FALLBACK === 'true';

console.log(`Running with USE_FALLBACK=${USE_FALLBACK}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Store cookies for reuse
const COOKIES_PATH = path.join(__dirname, 'cookies.json');

// Try to pre-load cookies if we're not in fallback mode
if (!USE_FALLBACK) {
  (async () => {
    try {
      // Use the enhanced bypass method
      await bypassCloudflareEnhanced('https://packageradar.com', COOKIES_PATH);
      console.log('Pre-loaded Cloudflare bypass cookies using enhanced method');
    } catch (error) {
      console.error('Failed to pre-load Cloudflare bypass cookies:', error.message);
      
      // Create an empty cookies file to avoid file not found errors
      try {
        await fs.writeFile(COOKIES_PATH, JSON.stringify([]));
        console.log('Created empty cookies file');
      } catch (writeError) {
        console.error('Error creating empty cookies file:', writeError.message);
      }
    }
  })();
} else {
  console.log('Running in fallback mode - skipping cookie pre-loading');
  
  // Create an empty cookies file to avoid file not found errors
  (async () => {
    try {
      await fs.writeFile(COOKIES_PATH, JSON.stringify([]));
      console.log('Created empty cookies file for fallback mode');
    } catch (error) {
      console.error('Error creating empty cookies file:', error.message);
    }
  })();
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Package Tracking API',
    usage: {
      endpoint: '/api/track',
      method: 'POST',
      body: {
        trackingNumber: 'your-tracking-number',
        courier: 'ups' // optional, defaults to ups
      }
    }
  });
});

// Tracking endpoint
app.post('/api/track', async (req, res) => {
  // Extract tracking number from request body
  const { trackingNumber, courier = 'ups' } = req.body;

  // Validate tracking number
  if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim() === '') {
    return res.status(400).json({
      error: 'Invalid tracking number provided',
      message: 'Please provide a valid tracking number in the request body'
    });
  }

  try {
    console.log(`Processing tracking request for: ${trackingNumber}`);

    // Try to load cookies first if they exist
    let cookies = [];
    try {
      const cookiesJson = await fs.readFile(COOKIES_PATH, 'utf-8');
      cookies = JSON.parse(cookiesJson);
      console.log(`Loaded ${cookies.length} cookies for request`);
    } catch (error) {
      console.log('No cookies found or error loading cookies:', error.message);
    }

    // Use the appropriate tracker based on environment and settings
    let result;
    let newCookies = []; // Initialize here to avoid undefined reference
    
    if (USE_FALLBACK) {
      // Use the fallback tracker in fallback mode
      const fallbackTracker = new FallbackTracker();
      result = await fallbackTracker.track(trackingNumber, courier);
      // Fallback tracker doesn't have cookies
    } else {
      // Use the MultiSourceTracker for better resilience
      const tracker = new MultiSourceTracker({
        timeout: 60000,
        maxRetries: 2,
        saveScreenshot: process.env.SAVE_DEBUG_SCREENSHOTS === 'true',
        cookies: cookies
      });
      
      result = await tracker.track(trackingNumber, courier);
      
      // Save any new cookies if available
      if (tracker.newCookies && tracker.newCookies.length > 0) {
        newCookies = tracker.newCookies; // Store for later use
        console.log(`Got ${tracker.newCookies.length} new cookies`);
      }
    }

    // Save cookies only if we got them (not in fallback mode)
    if (newCookies.length > 0) {
      await fs.writeFile(COOKIES_PATH, JSON.stringify(newCookies, null, 2));
      console.log(`Saved ${newCookies.length} new cookies`);
    }

    // Return tracking data as JSON
    res.json(result);
  } catch (error) {
    console.error('Tracking error:', error.message);

    // If we encounter a tracking error and we're not in fallback mode
    // Try to regenerate cookies for next requests
    if (!USE_FALLBACK) {
      try {
        // Use enhanced bypass method
        await bypassCloudflareEnhanced('https://packageradar.com', COOKIES_PATH);
        console.log('Regenerated Cloudflare bypass cookies after error');
      } catch (bypassError) {
        console.error('Failed to regenerate Cloudflare bypass cookies:', bypassError.message);
      }
    }

    res.status(500).json({
      error: 'Tracking failed',
      message: error.message
    });
  }
});

// Add a manual Cloudflare cookie regeneration endpoint (for admin use)
app.post('/api/regenerate-cookies', async (req, res) => {
  try {
    // Use enhanced method
    const cookies = await bypassCloudflareEnhanced('https://packageradar.com', COOKIES_PATH);
    res.json({
      success: true,
      message: `Successfully regenerated ${cookies.length} cookies`,
      count: cookies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate cookies',
      message: error.message
    });
  }
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    fallbackMode: USE_FALLBACK
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- API available at: http://localhost:${PORT}/api/track`);
  console.log(`- Usage information at: http://localhost:${PORT}/`);
  console.log(`- Health check at: http://localhost:${PORT}/health`);
});
// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const { PackageRadarTracker } = require('./PackageRadarTracker');
// const { FallbackTracker } = require('./fallback-tracker');
// const { loadAndUseCookies } = require('./cloudflare-bypass');
// const fs = require('fs').promises;
// const path = require('path');

// // Determine if we should use the fallback tracker
// // const USE_FALLBACK = process.env.NODE_ENV === 'production';
// const USE_FALLBACK = process.env.USE_FALLBACK === 'true';



// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // Store cookies for reuse
// const COOKIES_PATH = path.join(__dirname, 'cookies.json');

// // Don't try to pre-load cookies on startup in production
// // as it might fail in a headless environment
// if (process.env.NODE_ENV !== 'production') {
//   (async () => {
//     try {
//       await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
//       console.log('Pre-loaded Cloudflare bypass cookies');
//     } catch (error) {
//       console.error('Failed to pre-load Cloudflare bypass cookies:', error.message);
//     }
//   })();
// } else {
//   console.log('Running in production mode - skipping cookie pre-loading');
  
//   // Create an empty cookies file to avoid file not found errors
//   try {
//     require('fs').writeFileSync(COOKIES_PATH, JSON.stringify([]));
//     console.log('Created empty cookies file');
//   } catch (error) {
//     console.error('Error creating empty cookies file:', error.message);
//   }
// }

// // Root endpoint
// app.get('/', (req, res) => {
//   res.json({
//     message: 'Package Tracking API',
//     usage: {
//       endpoint: '/api/track',
//       method: 'POST',
//       body: {
//         trackingNumber: 'your-tracking-number'
//       }
//     }
//   });
// });

// // Tracking endpoint
// // Fix for the "tracker is not defined" error
// // In server.js - Modify the tracking endpoint

// app.post('/api/track', async (req, res) => {
//   // Extract tracking number from request body
//   const { trackingNumber, courier = 'ups' } = req.body;

//   // Validate tracking number
//   if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim() === '') {
//     return res.status(400).json({
//       error: 'Invalid tracking number provided',
//       message: 'Please provide a valid tracking number in the request body'
//     });
//   }

//   try {
//     console.log(`Processing tracking request for: ${trackingNumber}`);

//     // Try to load cookies first if they exist
//     let cookies = [];
//     try {
//       const cookiesJson = await fs.readFile(COOKIES_PATH, 'utf-8');
//       cookies = JSON.parse(cookiesJson);
//       console.log(`Loaded ${cookies.length} cookies for request`);
//     } catch (error) {
//       console.log('No cookies found or error loading cookies:', error.message);
//     }

//     // Use the appropriate tracker based on environment
//     let result;
//     let newCookies = []; // Initialize here to avoid undefined reference
    
//     if (USE_FALLBACK) {
//       // Use the fallback tracker in production
//       const fallbackTracker = new FallbackTracker();
//       result = await fallbackTracker.track(trackingNumber, courier);
//       // Fallback tracker doesn't have cookies
//     } else {
//       // Use the full Puppeteer tracker in development
//       const tracker = new PackageRadarTracker({
//         headless: true,
//         timeout: 60000,
//         cookies: cookies
//       });
//       result = await tracker.track(trackingNumber, courier);
      
//       // Save any new cookies if available
//       if (tracker.newCookies && tracker.newCookies.length > 0) {
//         newCookies = tracker.newCookies; // Store for later use
//         console.log(`Got ${tracker.newCookies.length} new cookies`);
//       }
//     }

//     // Save cookies only if we got them (not in fallback mode)
//     if (newCookies.length > 0) {
//       await fs.writeFile(COOKIES_PATH, JSON.stringify(newCookies, null, 2));
//       console.log(`Saved ${newCookies.length} new cookies`);
//     }

//     // Return tracking data as JSON
//     res.json(result);
//   } catch (error) {
//     console.error('Tracking error:', error.message);

//     // If we encounter a tracking error, it might be due to Cloudflare
//     // Try to regenerate cookies for next requests - BUT only if we're not in fallback mode already
//     if (!USE_FALLBACK) {
//       try {
//         await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
//         console.log('Regenerated Cloudflare bypass cookies after error');
//       } catch (bypassError) {
//         console.error('Failed to regenerate Cloudflare bypass cookies:', bypassError.message);
//       }
//     }

//     res.status(500).json({
//       error: 'Tracking failed',
//       message: error.message
//     });
//   }
// });


// // Add a manual Cloudflare cookie regeneration endpoint (for admin use)
// app.post('/api/regenerate-cookies', async (req, res) => {
//   try {
//     const cookies = await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
//     res.json({
//       success: true,
//       message: `Successfully regenerated ${cookies.length} cookies`,
//       count: cookies.length
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: 'Failed to regenerate cookies',
//       message: error.message
//     });
//   }
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`- API available at: http://localhost:${PORT}/api/track`);
//   console.log(`- Usage information at: http://localhost:${PORT}/`);
// });
