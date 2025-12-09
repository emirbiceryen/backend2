const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(token, title, body) {
  if (!token) {
    console.warn('[sendPushNotification] Missing push token');
    return;
  }

  try {
    const payload = {
      to: token,
      sound: 'default',
      title,
      body,
    };

    const response = await axios.post(EXPO_PUSH_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.data?.data?.status === 'error') {
      console.error('[sendPushNotification] Expo error:', response.data?.data);
    }
  } catch (error) {
    console.error('[sendPushNotification] Failed:', error.message);
  }
}

module.exports = {
  sendPushNotification,
};


