const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { PackageRadarTracker } = require('./PackageRadarTracker');
const { loadAndUseCookies } = require('./cloudflare-bypass');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Store cookies for reuse
const COOKIES_PATH = path.join(__dirname, 'cookies.json');

// Initialize cookies on startup if possible
(async () => {
  try {
    await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
    console.log('Pre-loaded Cloudflare bypass cookies');
  } catch (error) {
    console.error('Failed to pre-load Cloudflare bypass cookies:', error.message);
  }
})();

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Package Tracking API',
    usage: {
      endpoint: '/api/track',
      method: 'POST',
      body: {
        trackingNumber: 'your-tracking-number'
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

    // Create tracker instance with production settings
    const tracker = new PackageRadarTracker({
      headless: true,
      timeout: 60000,
      cookies: cookies
    });

    // Track the package
    const result = await tracker.track(trackingNumber, courier);

    // Save any new cookies if available
    if (tracker.newCookies && tracker.newCookies.length > 0) {
      await fs.writeFile(COOKIES_PATH, JSON.stringify(tracker.newCookies, null, 2));
      console.log(`Saved ${tracker.newCookies.length} new cookies`);
    }

    // Return tracking data as JSON
    res.json(result);
  } catch (error) {
    console.error('Tracking error:', error.message);

    // If we encounter a tracking error, it might be due to Cloudflare
    // Try to regenerate cookies for next requests
    try {
      await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
      console.log('Regenerated Cloudflare bypass cookies after error');
    } catch (bypassError) {
      console.error('Failed to regenerate Cloudflare bypass cookies:', bypassError.message);
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
    const cookies = await loadAndUseCookies('https://packageradar.com', COOKIES_PATH);
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- API available at: http://localhost:${PORT}/api/track`);
  console.log(`- Usage information at: http://localhost:${PORT}/`);
});
