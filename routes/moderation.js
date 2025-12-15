const express = require('express');
const vision = require('@google-cloud/vision');
const path = require('path');

const router = express.Router();

// Likelihood ranking for SafeSearch
const likelihoodRank = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

const DEFAULT_KEYFILE = path.join(__dirname, '..', 'keys', 'vision-sa.json');

// Initialize Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GCV_KEY_FILE || DEFAULT_KEYFILE,
});

/**
 * POST /api/moderation/analyzeImage
 * Body:
 *  - imageUrl: string (optional)
 *  - imageBase64: string (optional, data URI allowed)
 */
router.post('/analyzeImage', async (req, res) => {
  try {
    const { imageUrl, imageBase64 } = req.body || {};

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl or imageBase64 is required',
      });
    }

    let image;
    if (imageUrl) {
      image = { source: { imageUri: imageUrl } };
    } else {
      // Strip data URI prefix if present
      const cleaned = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      image = { content: cleaned };
    }

    const [result] = await client.safeSearchDetection({ image });
    const annotation = result?.safeSearchAnnotation || {};

    const scores = {
      adult: annotation.adult || 'UNKNOWN',
      violence: annotation.violence || 'UNKNOWN',
      medical: annotation.medical || 'UNKNOWN',
      spoof: annotation.spoof || 'UNKNOWN',
      racy: annotation.racy || 'UNKNOWN',
    };

    const redFlag =
      ['adult', 'violence', 'racy']
        .map((k) => likelihoodRank[scores[k]] || 0)
        .some((rank) => rank >= likelihoodRank.LIKELY);

    return res.json({
      success: true,
      scores,
      redFlag,
    });
  } catch (error) {
    console.error('SafeSearch analyzeImage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze image',
      error: error.message || 'unknown_error',
    });
  }
});

module.exports = router;

