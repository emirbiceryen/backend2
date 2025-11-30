const { OAuth2Client } = require('google-auth-library');

const parseClientIds = (rawValue = '') => {
  if (!rawValue) return [];

  let values = [];
  const trimmed = rawValue.trim();

  // Support JSON array format
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        values = parsed;
      }
    } catch (error) {
      console.warn('[Google OAuth] Failed to parse GOOGLE_CLIENT_IDS JSON value:', error.message);
    }
  }

  if (values.length === 0) {
    values = trimmed
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return values;
};

const googleClientIds = parseClientIds(
  process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || ''
);

let googleOAuthClient = null;

if (googleClientIds.length) {
  googleOAuthClient = new OAuth2Client(googleClientIds[0]);
} else {
  console.warn('[Google OAuth] No Google client IDs configured. Google sign-in will be disabled.');
}

const isGoogleAuthConfigured = () => googleClientIds.length > 0;

const verifyGoogleIdToken = async (idToken) => {
  if (!googleOAuthClient) {
    throw new Error('Google authentication is not configured.');
  }

  return googleOAuthClient.verifyIdToken({
    idToken,
    audience: googleClientIds,
  });
};

module.exports = {
  googleClientIds,
  googleOAuthClient,
  isGoogleAuthConfigured,
  verifyGoogleIdToken,
};



