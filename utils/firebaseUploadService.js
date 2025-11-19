const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Check if Firebase credentials are provided
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const firebaseBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!serviceAccountJson || !firebaseBucket) {
      console.error('[Firebase] Service account or bucket not configured. File uploads will fail.');
      console.error('[Firebase] FIREBASE_SERVICE_ACCOUNT:', serviceAccountJson ? 'SET (length: ' + serviceAccountJson.length + ')' : 'NOT SET');
      console.error('[Firebase] FIREBASE_STORAGE_BUCKET:', firebaseBucket || 'NOT SET');
      console.error('[Firebase] Set FIREBASE_SERVICE_ACCOUNT (JSON string or base64) and FIREBASE_STORAGE_BUCKET in environment variables.');
      firebaseInitialized = false;
      return;
    }

    // Parse service account JSON
    // Support both direct JSON string and base64 encoded JSON
    let serviceAccount;
    try {
      let jsonString = serviceAccountJson;
      
      // Try to decode as base64 first (if it's base64 encoded)
      try {
        const decoded = Buffer.from(jsonString, 'base64').toString('utf-8');
        // If decoded string looks like JSON, use it
        if (decoded.trim().startsWith('{')) {
          jsonString = decoded;
          console.log('[Firebase] Service account was base64 encoded, decoded successfully');
        }
      } catch (base64Error) {
        // Not base64, continue with original string
        console.log('[Firebase] Service account is not base64 encoded, using as direct JSON string');
      }
      
      // Try to parse as JSON
      if (typeof jsonString === 'string') {
        // Replace escaped newlines and quotes if needed
        const cleanedJson = jsonString
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'");
        
        serviceAccount = JSON.parse(cleanedJson);
      } else {
        serviceAccount = jsonString;
      }
      
      console.log('[Firebase] Service account JSON parsed successfully');
    } catch (parseError) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseError.message);
      console.error('[Firebase] JSON string preview (first 200 chars):', serviceAccountJson.substring(0, 200));
      console.error('[Firebase] Parse error details:', {
        name: parseError.name,
        message: parseError.message,
        stack: parseError.stack
      });
      firebaseInitialized = false;
      return;
    }

    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: firebaseBucket
      });
    }

    firebaseInitialized = true;
    console.log('[Firebase] Initialized successfully with bucket:', firebaseBucket);
  } catch (error) {
    console.error('[Firebase] Initialization error:', error.message);
    firebaseInitialized = false;
  }
};

// Get Firebase Storage bucket
const getBucket = () => {
  if (!firebaseInitialized) {
    initializeFirebase();
  }

  if (!firebaseInitialized) {
    throw new Error('Firebase is not initialized. Check your FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.');
  }

  return admin.storage().bucket();
};

/**
 * Upload a file to Firebase Storage
 * @param {Object} file - Multer file object (from memory storage)
 * @param {String} folder - Folder path in Firebase Storage (e.g., 'profile', 'forum', 'events')
 * @param {String} customFileName - Optional custom filename (without extension)
 * @returns {Promise<String>} Public URL of the uploaded file
 */
const uploadFile = async (file, folder = 'uploads', customFileName = null) => {
  try {
    console.log('[Firebase] Starting file upload...');
    console.log('[Firebase] File object:', {
      hasFile: !!file,
      hasBuffer: !!(file && file.buffer),
      fieldname: file?.fieldname,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      bufferLength: file?.buffer?.length
    });

    if (!file || !file.buffer) {
      throw new Error('Invalid file object. File must have a buffer property (use multer memoryStorage).');
    }

    const bucket = getBucket();
    console.log('[Firebase] Bucket retrieved:', bucket.name);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname || 'file');
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const fileName = customFileName 
      ? `${customFileName}${fileExtension}`
      : `${file.fieldname || 'file'}-${timestamp}-${randomSuffix}${fileExtension}`;
    
    const filePath = `${folder}/${fileName}`;

    // Create file reference
    const fileRef = bucket.file(filePath);

    // Upload file buffer
    const stream = fileRef.createWriteStream({
      metadata: {
        contentType: file.mimetype || 'application/octet-stream',
        metadata: {
          originalName: file.originalname || 'file',
          uploadedAt: new Date().toISOString()
        }
      },
      public: true, // Make file publicly accessible
      resumable: false
    });

    // Upload the buffer
    await new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('[Firebase] Upload stream error:', error);
        reject(error);
      });

      stream.on('finish', () => {
        resolve();
      });

      stream.end(file.buffer);
    });

    // Make file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    console.log(`[Firebase] File uploaded successfully: ${filePath}`);
    return publicUrl;
  } catch (error) {
    console.error('[Firebase] Upload error:', error.message);
    console.error('[Firebase] Upload error stack:', error.stack);
    console.error('[Firebase] Upload error details:', {
      name: error.name,
      code: error.code,
      message: error.message
    });
    throw error;
  }
};

/**
 * Upload multiple files to Firebase Storage
 * @param {Array} files - Array of Multer file objects
 * @param {String} folder - Folder path in Firebase Storage
 * @returns {Promise<Array<String>>} Array of public URLs
 */
const uploadMultipleFiles = async (files, folder = 'uploads') => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  try {
    const uploadPromises = files.map(file => uploadFile(file, folder));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('[Firebase] Multiple files upload error:', error.message);
    throw error;
  }
};

/**
 * Delete a file from Firebase Storage
 * @param {String} fileUrl - Public URL of the file to delete
 * @returns {Promise<Boolean>} True if deleted successfully
 */
const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return false;
    }

    // Extract file path from URL
    // URL format: https://storage.googleapis.com/bucket-name/folder/filename
    const urlParts = fileUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part.includes('storage.googleapis.com'));
    
    if (bucketIndex === -1 || bucketIndex >= urlParts.length - 1) {
      console.warn('[Firebase] Invalid file URL format:', fileUrl);
      return false;
    }

    // Get path after bucket name
    const filePath = urlParts.slice(bucketIndex + 2).join('/');

    const bucket = getBucket();
    const fileRef = bucket.file(filePath);

    // Check if file exists
    const [exists] = await fileRef.exists();
    if (!exists) {
      console.warn('[Firebase] File does not exist:', filePath);
      return false;
    }

    // Delete file
    await fileRef.delete();
    console.log(`[Firebase] File deleted successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error('[Firebase] Delete error:', error.message);
    return false;
  }
};

// Initialize on module load
initializeFirebase();

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  initializeFirebase,
  isInitialized: () => firebaseInitialized
};

