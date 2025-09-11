const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Note: You'll need to download the service account key from Firebase Console
// and place it in the backend directory as 'firebase-service-account.json'
let firebaseApp = null;

const initializeFirebase = () => {
  if (!firebaseApp) {
    try {
      const serviceAccount = require('../firebase-service-account.json');
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // You can also use project ID from environment variables
        // projectId: process.env.FIREBASE_PROJECT_ID,
      });
      
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      console.log('Make sure you have downloaded the service account key and placed it as firebase-service-account.json');
    }
  }
  return firebaseApp;
};

class FirebaseService {
  constructor() {
    this.app = initializeFirebase();
  }

  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      // Get user's FCM token from database
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user || !user.fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return { success: false, message: 'No FCM token found' };
      }

      // Check if user has notifications enabled for this type
      const notificationType = data.type || 'general';
      if (user.notificationSettings && !user.notificationSettings[notificationType]) {
        console.log(`Notifications disabled for user ${userId}, type: ${notificationType}`);
        return { success: false, message: 'Notifications disabled for this type' };
      }

      const message = {
        token: user.fcmToken,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          userId: userId.toString(),
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#3C0270',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToMultipleUsers(userIds, title, body, data = {}) {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      const User = require('../models/User');
      const users = await User.find({ 
        _id: { $in: userIds },
        fcmToken: { $exists: true, $ne: null }
      });

      if (users.length === 0) {
        return { success: false, message: 'No users with FCM tokens found' };
      }

      const tokens = users
        .filter(user => {
          const notificationType = data.type || 'general';
          return !user.notificationSettings || user.notificationSettings[notificationType];
        })
        .map(user => user.fcmToken);

      if (tokens.length === 0) {
        return { success: false, message: 'No users with notifications enabled' };
      }

      const message = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#3C0270',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`Successfully sent message to ${response.successCount} users`);
      
      return { 
        success: true, 
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToTopic(topic, title, body, data = {}) {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      const message = {
        topic,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#3C0270',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message to topic:', response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification to topic:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate FCM token
  async validateToken(token) {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      // Try to send a test message to validate the token
      const message = {
        token,
        data: {
          test: 'true',
        },
        android: {
          priority: 'normal',
        },
        apns: {
          headers: {
            'apns-priority': '5',
          },
        },
      };

      await admin.messaging().send(message);
      return { valid: true };
    } catch (error) {
      console.error('Token validation failed:', error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new FirebaseService();