const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { PackageRadarTracker } = require('./PackageRadarTracker');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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
  const { trackingNumber } = req.body;

  // Validate tracking number
  if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim() === '') {
    return res.status(400).json({
      error: 'Invalid tracking number provided',
      message: 'Please provide a valid tracking number in the request body'
    });
  }

  try {
    console.log(`Processing tracking request for: ${trackingNumber}`);
    
    // Create tracker instance with production settings
    const tracker = new PackageRadarTracker({
      headless: true,
      timeout: 60000
    });
    
    // Track the package (using default 'ups' courier)
    const result = await tracker.track(trackingNumber);
    
    // Return tracking data as JSON (trackingNumber field is now removed in the tracker)
    res.json(result);
  } catch (error) {
    console.error('Tracking error:', error.message);
    
    res.status(500).json({
      error: 'Tracking failed',
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
